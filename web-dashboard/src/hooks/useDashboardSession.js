import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
const zoneNames = [
    "left_corner_3",
    "left_wing_3",
    "top_key_3",
    "right_wing_3",
    "right_corner_3",
    "left_midrange",
    "center_paint",
    "right_midrange",
];
function defaultZones() {
    return zoneNames.reduce((acc, zone) => ({ ...acc, [zone]: { attempts: 0, makes: 0, percentage: 0 } }), {});
}
export function useDashboardSession() {
    const [sessionId, setSessionId] = useState("");
    const [connected, setConnected] = useState(false);
    const [attempts, setAttempts] = useState(0);
    const [makes, setMakes] = useState(0);
    const [misses, setMisses] = useState(0);
    const [fgPct, setFgPct] = useState(0);
    const [avgLatency, setAvgLatency] = useState(0);
    const [avgFormScore, setAvgFormScore] = useState(0);
    const [currentStreak, setCurrentStreak] = useState(0);
    const [bestStreak, setBestStreak] = useState(0);
    const [zones, setZones] = useState(defaultZones);
    const [feed, setFeed] = useState([]);
    const [error, setError] = useState("");
    const socketRef = useRef(null);
    const canJoin = useMemo(() => sessionId.trim().length > 0, [sessionId]);
    async function fetchSummary(id) {
        const response = await fetch(`${API_BASE_URL}/api/sessions/${id}/summary`);
        if (!response.ok) {
            throw new Error(`Failed to fetch summary (${response.status})`);
        }
        const summary = (await response.json());
        setZones(summary.zone_breakdown);
        setAttempts(summary.attempts);
        setMakes(summary.makes);
        setMisses(summary.misses);
        setFgPct(summary.fg_pct);
        setAvgLatency(summary.average_inference_latency_ms);
        setAvgFormScore(summary.average_form_score);
        setCurrentStreak(summary.current_streak);
        setBestStreak(summary.best_streak);
    }
    async function createAndJoinSession() {
        setError("");
        try {
            const response = await fetch(`${API_BASE_URL}/api/sessions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ athlete_id: "web-dashboard" }),
            });
            if (!response.ok) {
                throw new Error(`Failed to create session (${response.status})`);
            }
            const payload = (await response.json());
            setSessionId(payload.session_id);
            joinSession(payload.session_id);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create session");
        }
    }
    function joinSession(id) {
        const nextId = (id ?? sessionId).trim();
        if (!nextId)
            return;
        setError("");
        socketRef.current?.disconnect();
        const socket = io(API_BASE_URL, { transports: ["websocket"] });
        socketRef.current = socket;
        socket.on("connect", async () => {
            setConnected(true);
            socket.emit("join_session", { session_id: nextId });
            try {
                await fetchSummary(nextId);
            }
            catch (err) {
                setError(err instanceof Error ? err.message : "Failed summary refresh");
            }
        });
        socket.on("disconnect", () => setConnected(false));
        socket.on("error", (payload) => {
            setError(payload.message ?? "Socket error");
        });
        socket.on("shot_event", (event) => {
            setAttempts(event.session_stats.attempts);
            setMakes(event.session_stats.makes);
            setMisses(event.session_stats.misses);
            setFgPct(event.session_stats.fg_pct);
            setAvgLatency(event.session_stats.avg_latency);
            setAvgFormScore(event.session_stats.avg_form_score);
            setCurrentStreak(event.session_stats.current_streak);
            setBestStreak(event.session_stats.best_streak);
            setFeed((prev) => [event, ...prev].slice(0, 24));
            fetchSummary(event.session_id).catch(() => {
                setError("Live update received, summary refresh failed.");
            });
        });
    }
    function disconnect() {
        socketRef.current?.disconnect();
        socketRef.current = null;
        setConnected(false);
    }
    useEffect(() => {
        return () => {
            socketRef.current?.disconnect();
        };
    }, []);
    return {
        sessionId,
        connected,
        attempts,
        makes,
        misses,
        fgPct,
        avgLatency,
        avgFormScore,
        currentStreak,
        bestStreak,
        zones,
        feed,
        error,
        setSessionId,
        canJoin,
        createAndJoinSession,
        joinSession,
        disconnect,
    };
}
