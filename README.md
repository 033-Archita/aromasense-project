# AromaSense

AromaSense is a CPU-friendly molecular odour prediction project with a separate virtual electronic-nose demonstration.

- **Molecular odour lab:** choose a molecule by name, inspect its RDKit structure drawing, and see ranked odour-descriptor estimates from the saved model.
- **Virtual electronic nose:** simulate MQ-2, temperature, and humidity responses during sample exposure and recovery.
- **Live monitoring:** view the generated sensor channels on separate charts.
- **Model insights:** review the dataset summary and held-out model scores.
- **How it works:** follow the project’s data, preparation, model, and evaluation story.

The molecular model and electronic-nose simulator are separate. Sensor values are generated for demonstration, labelled simulated, and never used as inputs to molecular prediction. Model scores estimate dataset labels; they are not direct measurements of human smell.

## Run locally

Requirements: Python 3.13 (or another supported Python with an RDKit wheel) and Node.js 20 or newer.

From the project root, create the Python environment and install the API dependencies:

~~~powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
~~~

In the first terminal, start the API:

~~~powershell
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
~~~

In a second terminal, start the frontend:

~~~powershell
cd frontend
npm install
npm run dev
~~~

Open the Vite URL, normally http://localhost:5173. The frontend connects to the API at http://127.0.0.1:8000. To use another API address, copy frontend/.env.example to frontend/.env, set VITE_API_URL, and restart Vite.

## Model

The saved model uses radius-2, 2,048-bit Morgan fingerprints and 138 class-balanced Extra Trees classifiers, each with 20 trees. Hyperparameters and the shared 0.60 decision cutoff were selected using validation data. Ranked descriptor scores remain available below the cutoff.

The held-out test set was not used to select model settings or the cutoff:

| Held-out test measure | Original baseline | Frozen model |
| --- | ---: | ---: |
| Macro precision | 0.309 | 0.294 |
| Macro recall | 0.209 | 0.359 |
| Macro F1 | 0.229 | 0.308 |
| Micro F1 | 0.376 | 0.401 |
| Macro ROC-AUC | 0.750 | 0.830 |
| Macro PR-AUC | 0.214 | 0.288 |

These results come from 997 held-out molecules. They are estimates of dataset label performance, and rare descriptors remain difficult to predict.

## Prediction API

- GET /api/health reports API and saved-model status.
- GET /api/model/summary returns dataset counts, evaluation scores, and common descriptors.
- POST /api/predict accepts a SMILES string and top_k, then returns ranked scores and an RDKit SVG drawing.

Example JSON body:

~~~json
{"smiles":"COc1cc(C=O)ccc1O","top_k":10}
~~~

Invalid structures return a useful HTTP error. The demo molecule buttons call the same prediction API; predictions are not hardcoded.

## Dataset and attribution

The model was trained with the OpenPOM-associated curated GS/LF merged dataset, containing 4,983 molecules and 138 binary odour descriptors. The source dataset is available from the [OpenPOM project data file](https://raw.githubusercontent.com/ARY2260/openpom/main/openpom/data/curated_datasets/curated_GS_LF_merged_4983.csv); the source project is [OpenPOM](https://github.com/BioMachineLearning/openpom).

This repository contains the saved model needed to run inference and the small audit/evaluation summaries used by the Model insights API. The source dataset and other generated reports are not included.
