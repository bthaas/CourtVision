---
license: apache-2.0
language:
- en
pretty_name: NBA data
size_categories:
- 10M<n<100M
---

## Dataset Summary
nba_dataset is a large-scale play-by-play and shot-detail dataset covering both NBA and WNBA games, collected from multiple public sources (e.g., official league APIs and stats sites). It provides every in-game event—from period starts, jump balls, fouls, turnovers, rebounds, and field-goal attempts through free throws—along with detailed shot metadata (shot location, distance, result, assisting player, etc.).

- Modality: Tabular, Text
- Format: Parquet
- Size: ~72.4 million rows (72.4 M events)
- License: Apache-2.0

#### Supported Tasks

- Event sequence modeling (e.g., predict next play)
- Shot-making and shot-selection analysis
- Team and player performance analytics
- Game-flow visualization

#### Languages
English (all textual descriptions in description, actionType, etc.)

## Dataset Creation
- **Curation Rationale**
To provide an integrated, granular view of every on-court NBA and WNBA event for advanced analytics, visualization, and modeling.

- **Source Data**  
  - NBA and WNBA API
  - [pbpstats.com](https://www.pbpstats.com/)

## How to Load the Dataset

**Using Hugging Face Datasets (Standard Method)**
```python
from datasets import load_dataset

# Login using e.g. `huggingface-cli login` to access this dataset
ds = load_dataset("Vladislav/nba_dataset")
```

**Using Polars**
```python
import polars as pl

# Login using e.g. `huggingface-cli login` to access this dataset
df = pl.read_parquet('hf://datasets/Vladislav/nba_dataset/**/*.parquet')
```

## Considerations for Use

- Training sequence models to predict next play or shot outcome
- Exploratory analysis of game flow (e.g., scoring runs)
- Visual dashboards of shot charts, momentum

## Additional Information
- **Citation**
```bibtex
@misc{vladislav_nba_dataset,
  title = {nba_dataset: NBA & WNBA Play-by-Play and Shot Details},
  author = {Vladislav Shufinskiy},
  year = {2025},
  publisher = {Hugging Face Datasets},
  howpublished = {\url{https://huggingface.co/datasets/Vladislav/nba_dataset}},
}
```

- **Contact**  
  - [LinkedIn](https://www.linkedin.com/in/vladislav-shufinskiy/)
  - [Github](https://github.com/shufinskiy)