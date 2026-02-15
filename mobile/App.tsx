import { SafeAreaView, StatusBar } from "react-native";
import { TrainingScreen } from "./src/screens/TrainingScreen";

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#030712" }}>
      <StatusBar barStyle="light-content" />
      <TrainingScreen />
    </SafeAreaView>
  );
}
