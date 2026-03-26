# Future Pose / Form Research

CourtVision currently ships as a shooting tracker, not a biomechanics coaching product.

If we revisit pose- or form-based coaching later, these are the most relevant starting points we found:

- BASKET (CVPR 2025): large-scale basketball skill-estimation dataset with fine-grained skill ratings and access-request workflow.
  - Paper: https://openaccess.thecvf.com/content/CVPR2025/html/Pan_BASKET_A_Large-Scale_Video_Dataset_for_Fine-Grained_Skill_Estimation_CVPR_2025_paper.html
  - Repo: https://github.com/yulupan00/BASKET
- TrackID3x3: 3x3 basketball dataset with tracking, identification, and some pose keypoints.
  - Repo: https://github.com/open-starlab/TrackID3x3
- DeepSport: basketball dataset family with court and player keypoint annotations that can help with pose/location pretraining.
  - Project: https://ispgroup.gitlab.io/code/deepsport/
- PoseShot (Scientific Reports 2026): free-throw pose-analysis paper with dataset availability listed on reasonable request rather than easy public download.
  - Paper: https://www.nature.com/articles/s41598-026-41025-0

Why we did not keep form coaching in the shipped product:

- Public basketball datasets with explicit "proper form" labels are still scarce.
- The closest datasets are either gated, very large, or not labeled for simple per-shot good/bad mechanics.
- "Proper form" also needs a shot-type-specific rubric, camera protocol, and expert labels before it is safe to productize.

Minimum bar before bringing coaching back:

1. Define a shot taxonomy: free throw, catch-and-shoot three, pull-up jumper, layup, etc.
2. Define a coach-reviewed label rubric for mechanics instead of a single universal "good form" score.
3. Collect or license a camera-consistent dataset with inter-rater agreement checks.
4. Keep the coaching model separate from the production shooting-tracker path until it proves reliable.
