<div align="center">

<img src="docs/assets/banner.svg" width="100%" alt="alive: what did this air do to me, and what should I do next?">

<br>

**Live, street-level air for the exact spot you're standing on in Delhi-NCR.<br>Routes priced in smoke, petrol and minutes. Real GPS navigation. No login.**

<br>

[![Live app](https://img.shields.io/badge/live-delhi--is--alive.vercel.app-16181B?style=for-the-badge)](https://delhi-is-alive.vercel.app)
![AWS](https://img.shields.io/badge/AWS-ECS%20Fargate%20%2B%20CloudFront-FF9900?style=for-the-badge&logo=amazonwebservices&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![MapLibre](https://img.shields.io/badge/MapLibre%20GL-4.7-396CB2?style=for-the-badge&logo=maplibre&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-6E93AE?style=for-the-badge)

**[Open the live app](https://delhi-is-alive.vercel.app)** &nbsp;·&nbsp; [Architecture](#architecture) &nbsp;·&nbsp; [The air field](#the-air-field) &nbsp;·&nbsp; [Route modes](#three-ways-to-go) &nbsp;·&nbsp; [AWS](#how-alive-uses-aws) &nbsp;·&nbsp; [Run it](#run-it-locally)

</div>

<br>

<table>
  <tr>
    <td align="center" width="33%"><img src="docs/screens/03b-home-address-blurred.jpg" width="240" alt="Home"><br><sub><b>Air where you stand</b><br>AQI, PM2.5 and PM10 for your exact point</sub></td>
    <td align="center" width="33%"><img src="docs/screens/06-modes.jpg" width="240" alt="Modes"><br><sub><b>Three ways to go</b><br>Health Maxer · Petrol + Health · Time + Health</sub></td>
    <td align="center" width="33%"><img src="docs/screens/08-routes-live-traffic.jpg" width="240" alt="Routes"><br><sub><b>Every route, priced honestly</b><br>live ETA · µg breathed · litres of petrol</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/screens/09-journey-navigation.jpg" width="240" alt="Navigation"><br><sub><b>Real GPS navigation</b><br>turns, reroutes, a receipt at the end</sub></td>
    <td align="center"><img src="docs/screens/11-air-tap-india-gate.jpg" width="240" alt="Air around me"><br><sub><b>Air Around Me</b><br>streets coloured by live air, tap anywhere</sub></td>
    <td align="center"><img src="docs/screens/12-purest-places.jpg" width="240" alt="Purest places"><br><sub><b>Purest places</b><br>the cleanest named spots near you, and any hotel's air</sub></td>
  </tr>
</table>

<br>

## Why

Delhi's AQI is a city number. It's on the news, it's on every weather app, and it tells you nothing about **you**: what you breathed on the way to work, whether the other road was cleaner, or whether 7 am or 4 pm is the better hour for a walk.

Nobody can choose Delhi's air. But everyone chooses a road, a time and a place, every day. ALive turns the live air over Delhi-NCR into those choices, for one person, at one point, right now.

## What it does

| | |
|---|---|
| **Air where you stand** | AQI, PM2.5 and PM10 at your exact point, in CPCB bands, with how old the reading is. Your address and DIGIPIN stay blurred until you tap them. |
| **Where To** | One From/To box. Suggestions appear while you type, from a 240,000-place Delhi index plus Ola Maps and Mappls, deep enough for a bakery in a lane or a house number. |
| **Three ways to go** | Health Maxer, Petrol + Health, Time + Health. Each card shows the live ETA, micrograms you'll breathe, litres of petrol and the jam delay. |
| **Live journey** | Real GPS through `watchPosition`. If you stop, it stops. Off the line for more than 10 seconds, it reroutes. The receipt shows your intake, where you got stuck and the smokiest stretch. |
| **Air Around Me** | A detailed map with every street coloured by the live field. Tap any point for its AQI and the best time of day to be out there. |
| **Purest places and stays** | The cleanest named places near you or across NCR. Search any hotel for its air now and its best and worst hours. |
| **Operator dashboard** | Users, journeys, modes, vehicles, smoke avoided and route concentration. Anonymous counts only. |

## Architecture

```mermaid
flowchart TB
    UI["Your phone or laptop<br/>ALive web app · MapLibre GL · GPS"]
    OFM["OpenFreeMap<br/>map tiles"]
    VC["Vercel<br/>static app + Analytics"]
    CF["Amazon CloudFront<br/>HTTPS"]

    subgraph AWS["AWS · ap-south-1 Mumbai"]
        NLB["Network Load Balancer"]
        SM[("Secrets Manager<br/>provider keys")]
        subgraph ECS["ECS Fargate · FastAPI · Python 3.12"]
            API["/v2 API"]
            FIELD["Air field engine"]
            SRCH["Search"]
            PLAN["Route + mode engine"]
        end
        S3[("Amazon S3<br/>field snapshots · archive")]
        DDB[("DynamoDB<br/>anonymous counters")]
    end

    subgraph SRC["Live sources"]
        AIR["CPCB · DPCC<br/>OpenAQ · WAQI"]
        MET["Open-Meteo<br/>CAMS model · wind"]
        MAPS["Ola Maps<br/>Mappls"]
        OSRM["OSRM<br/>OpenStreetMap roads"]
        TT["TomTom<br/>live traffic"]
    end

    UI --> VC --> CF --> NLB --> API
    UI -. tiles .-> OFM
    SM -. keys at task start .-> API
    API --> DDB
    API --> FIELD & SRCH & PLAN
    FIELD --> S3
    FIELD --> AIR & MET
    SRCH --> MAPS
    PLAN --> OSRM & TT

    classDef aws fill:#FFF4E5,stroke:#FF9900,color:#1A1A1A
    classDef src fill:#EEF3F7,stroke:#6E93AE,color:#1A1A1A
    classDef dev fill:#F7F4EC,stroke:#C7A34F,color:#1A1A1A
    class NLB,API,FIELD,SRCH,PLAN,S3,DDB,SM aws
    class AIR,MET,MAPS,TT,OSRM src
    class UI,OFM,VC,CF dev
```

The browser talks to one origin. Vercel serves the app's files and forwards every API path to CloudFront, which sits in front of a Network Load Balancer and the Fargate tasks. Map tiles come straight from OpenFreeMap. Provider keys never reach the browser: the API calls Ola Maps, Mappls and TomTom on the app's behalf, with per-provider daily budgets and caching.

## How a trip gets planned

```mermaid
sequenceDiagram
    autonumber
    actor U as You
    participant A as ALive app
    participant S as API on Fargate
    participant P as Ola Maps · Mappls
    participant R as OSRM
    participant T as TomTom
    participant F as Air field

    U->>A: type "cyber hub"
    par instant
        A->>S: GET /v2/ac
        S-->>A: local index rows
    and providers
        A->>S: GET /v2/p/ac
        S->>P: autocomplete + geocode
        S-->>A: provider rows
    end
    A-->>U: one merged, ranked list
    U->>A: pick a mode and a vehicle
    A->>S: POST /v2/plan
    S->>R: alternative roads
    S->>T: live travel time + jams on each road
    S->>F: PM2.5 along every road
    S-->>A: cards with live ETA, µg inhaled, litres, jam delay
    U->>A: Start
    loop every GPS fix
        A->>A: progress, next turn, off-route check
        opt off the line by 60 m for 10 s
            A->>S: POST /v2/reroute
        end
    end
    A-->>U: receipt: intake, jammed stretches, smokiest stretch
```

## The air field

```mermaid
flowchart LR
    subgraph IN["Rebuilt every 15 minutes"]
        direction TB
        ST["Ground monitors<br/>CPCB · DPCC · OpenAQ · WAQI"]
        MD["CAMS model grid<br/>via Open-Meteo"]
        WD["Wind speed + direction<br/>Open-Meteo"]
    end
    ST --> KR["Kriging on station-minus-model residuals<br/>a value and an uncertainty per cell"]
    MD --> KR
    WD --> IDW["Wind-aware weighting<br/>upwind up to 1.45× · downwind 0.55×"]
    KR --> FLD[("Live field<br/>PM2.5 · PM10")]
    IDW --> FLD
    FLD --> O1["AQI at your point<br/>CPCB formula"]
    FLD --> O2["Street colours<br/>Air Around Me"]
    FLD --> O3["Dose along routes"]
    FLD --> O4["Next-24-hour outlook<br/>best and worst hour"]
    FLD --> ARC[("S3 snapshots<br/>+ hourly archive")]

    classDef out fill:#F7F4EC,stroke:#C7A34F,color:#1A1A1A
    class O1,O2,O3,O4 out
```

- **Ground truth beats the model.** Monitor readings from CPCB, DPCC, OpenAQ and WAQI are weighted above the CAMS background grid.
- **Smoke moves with the wind.** A monitor upwind of you counts for more than one downwind, scaled by wind speed. In calm air the weighting is even.
- **Uncertainty is kept, not hidden.** Kriging gives every cell a value and a spread, and the spread travels downstream as the dose band.
- **One field, one scale.** Home, Air Around Me, routes and the planning card all read the same field and the same CPCB AQI scale.

## Three ways to go

```mermaid
flowchart TD
    C["Real candidate roads<br/>each with live ETA · µg dose · litres"] --> HM["Health Maxer<br/>lowest dose, no compromise"]
    C --> G{"Clean-air guard<br/>dose ≤ 1.15 × the cleanest road"}
    G --> PH["Petrol + Health<br/>least fuel inside the guard"]
    G --> TH["Time + Health<br/>fastest live ETA inside the guard"]
    HM & PH & TH --> W["The card names its reason<br/>least smoke · least fuel · fastest now"]

    classDef mode fill:#F7F4EC,stroke:#C7A34F,color:#1A1A1A
    class HM,PH,TH mode
```

| Number on the card | Where it comes from |
|---|---|
| **µg breathed** | PM2.5 sampled along each segment × minutes on it × minute ventilation for that way of travelling, adjusted for the vehicle's micro-environment |
| **Litres** | Vehicle class and fuel, the road's speeds, and idling in jams. No prices, only fuel. |
| **Live ETA** | TomTom's live travel time on that exact road, with Ola Maps as a fallback. The same road shows the same time in every mode. |
| **Jam delay** | Live time minus free-flow time, with the jammed sections drawn on the map |

If one road is the cleanest, the fastest and the lightest on fuel, all three modes pick it and say so. ALive never invents a difference to make the modes look distinct.

## Search

```mermaid
flowchart LR
    K["keystroke"] --> L["/v2/ac · local index<br/>240,027 Delhi + 19,004 NCR places"]
    K --> P["/v2/p/ac · Ola Maps + Mappls"]
    P --> B["Mappls names geocoded<br/>through Ola for coordinates"]
    K -. pause or Enter .-> D["/v2/search · deep tier"]
    L & B & D --> M["merge · de-duplicate · junk filter · rank<br/>name match · locality · category · distance"]
    M --> R["rows paint as they arrive"]
```

The local index answers first, so the list is never blank while you type. Provider rows join as they land. Ranking follows general rules: exact name, the locality you typed, the kind of place, and distance. Index rows with a far-away city's name at a Delhi point, like a "Hotel Shimla" pinned on Lodhi Road, are filtered out by those rules too.

## Tech stack

| Layer | Built with |
|---|---|
| **Web app** | Vanilla JavaScript, HTML, CSS · MapLibre GL JS 4.7 · OpenFreeMap Positron basemap · Vercel Analytics |
| **API** | Python 3.12 · FastAPI · Uvicorn · httpx · NumPy · H3 · boto3 |
| **Native core** | `alive_core` in C++ via pybind11: search index, dose and emission kernels, with a pure-Python reference fallback |
| **Routing** | OSRM on OpenStreetMap roads · TomTom live traffic · Ola Maps fallback |
| **Places** | 240,027-place Delhi gazetteer · 19,004 NCR places from GeoNames · Ola Maps · Mappls |
| **Air** | CPCB · DPCC · OpenAQ · WAQI · CAMS via Open-Meteo · Open-Meteo wind |
| **Location codes** | India Post DIGIPIN, computed on the device |
| **Cloud** | ECS Fargate · Network Load Balancer · CloudFront · CodeBuild · ECR · S3 · DynamoDB · Secrets Manager |

## How ALive uses AWS

Everything runs in **ap-south-1 (Mumbai)**.

| Service | What it does in ALive |
|---|---|
| **ECS Fargate** | Runs the FastAPI container: the API, the air field engine, search and the route engine. No servers to manage. |
| **Network Load Balancer** | Fronts the Fargate tasks |
| **CloudFront** | HTTPS and cache rules in front of the API. Vercel forwards every API path here. |
| **CodeBuild** | Builds the Docker image from `server/` on every deploy |
| **ECR** | Stores the images, tagged by commit SHA |
| **Secrets Manager** | Ola Maps, Mappls, TomTom, OpenAQ and WAQI keys plus the operator token, injected when a task starts |
| **S3** | Air field snapshots and the hourly archive |
| **DynamoDB** | The anonymous counters behind the operator dashboard |

```mermaid
flowchart LR
    subgraph API["API release"]
        direction LR
        DS["scripts/deploy.sh"] --> CB["AWS CodeBuild<br/>server/buildspec.yml"]
        CB --> IMG["Docker multi-stage build<br/>C++ core + FastAPI"]
        IMG --> ECR[("Amazon ECR<br/>tag = commit SHA")]
        ECR --> SVC["ECS Fargate<br/>rolling update"]
        SVC --> H["/health reports build_sha"]
    end
    subgraph WEB["Web release"]
        direction LR
        VD["vercel deploy · web/edge"] --> VE["Vercel<br/>static /app + API rewrite"]
    end
```

## Privacy

| Stays on your phone | Sent only with the request that needs it | Counted anonymously |
|---|---|---|
| Name, saved places, trips and receipts, settings | The point you ask about: to read its air, name its street, find places, or plan a route | Journeys, modes, vehicles, micrograms avoided, age group, area |

- No login and no account. Profile and trips live in the browser's local storage, and "Delete my data" clears them.
- Telemetry is batched and rate-limited, and never carries names, coordinates, addresses, PINs or links.
- The exact address and DIGIPIN on Home are blurred until you tap them, so a shared screen doesn't give away where you are.

## Honest by design

- Every number on screen traces back to a monitor, a route, a traffic reading or a calculation on those.
- A missing value is said out loud ("no live traffic reading", "thin read") and never filled with a zero.
- Freshness comes from the reading's own timestamp: "updated 3 min ago".
- If a route starts or ends away from the point you picked, the card says by how much.
- Without WebGL the map shows a plain note instead of a blank box.

## API

| Endpoint | What it returns |
|---|---|
| `GET /health` | Running `build_sha`, field age, per-source status |
| `GET /aqi?lat=&lon=` | PM2.5, PM10 and AQI at a point |
| `GET /v2/ac` | Instant suggestions from the local index |
| `GET /v2/p/ac` | Suggestions from Ola Maps and Mappls |
| `GET /v2/p/reverse` | Street address for a point |
| `POST /v2/plan` | Routes for a mode and a vehicle: live ETA, dose, fuel, jams |
| `POST /v2/reroute` | A fresh route when you leave the line |
| `GET /v2/strip` | The field sampled along a route |
| `GET /v2/day` | Best and worst hours for a point |
| `GET /v2/purest` | The cleanest named places nearby |
| `GET /v2/stays` | Hotels with their air |
| `POST /v2/tally` | Anonymous counters |

## Run it locally

```bash
git clone https://github.com/GC-WORK11/ALive.git
cd ALive/server
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # every key is optional
uvicorn main:app --port 8080    # then open http://localhost:8080/app/
```

Without `OLA_API_KEY`, `MAPPLS_API_KEY` and `TOMTOM_API_KEY`, search runs on the local index and routes run without live traffic, and the app says so on every card. Tests: `PYTHONPATH=. python -m pytest -q tests`.

<details>
<summary><b>Repository layout</b></summary>

```text
server/          FastAPI app: air field, ingest, routing, exposure, emissions
  webapp/        the web app (vanilla JS + MapLibre)
  v2/            search, providers, plan, modes, trip, city, explore
  core/          alive_core C++ (pybind11): search index, dose kernels
  data/          Delhi gazetteer, NCR places, aliases
  tests/         pytest suite
web/edge/        Vercel config: static app + API rewrite to CloudFront
infra/           provisioning, schedules, CloudWatch dashboard
scripts/         deploy and smoke checks
Mobile/          the earlier Expo (React Native) app
docs/            design notes and reports
```

</details>

## Known limits

- Search can still rank two places with the same name in the wrong order.
- Outside monitor coverage the app marks a reading as thin rather than guess.
- Real-road navigation needs far more kilometres of testing than a hackathon allows.

## Credits

Air data from **CPCB** and **DPCC**, **OpenAQ**, **WAQI**, and **Copernicus CAMS** via **Open-Meteo**. Places, routes and traffic from **Ola Maps**, **Mappls**, **TomTom** and **OSRM**. Map data © **OpenStreetMap** contributors, tiles by **OpenFreeMap**. NCR places from **GeoNames** (CC BY 4.0). Location codes by **India Post DIGIPIN**.

Built for the **AWS × WeMakeDevs Environmental Hacks 2026**. Released under the [MIT License](LICENSE).
