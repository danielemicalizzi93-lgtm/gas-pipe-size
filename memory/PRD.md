# GasCalc Pro – PRD

## Problem statement
"crea un'app per dimensionare la tubazione del gas (metano/GPL) in base alla lunghezza e potenze termiche assorbite"

## User choices
- Method: UNI 7129 tables (max Δp 1 mbar metano / 2 mbar GPL)
- Materials: acciaio, rame, multistrato
- Appliance list with kW, auto-summed
- Saved calculation history
- Clean technical/professional style (burnt orange accent)

## Architecture
- Backend FastAPI + MongoDB: `/api/calculate`, `/api/calculations` (POST/GET/GET id/DELETE). Renouard formula Δp = 23200·d·L·Q^1.82·D^-4.82 (basis of UNI 7129 tables). Gas: metano PCI 9.45 kWh/m³ d=0.6; GPL PCI 25.9 kWh/m³ d=1.56. Internal diameters for steel (EN 10255), copper (EN 1057), multilayer.
- Frontend Expo Router: tabs (Calcola, Storico), modal /result, /history/[id].

## Implemented (2026-06)
- Multi-segment network (tratti/diramazioni) sized with the UNI 7129 table method: each segment uses its own flow and the total length from the meter to the farthest appliance; cumulative Δp shown for each segment
- Technical PDF report (expo-print + expo-sharing) with installer logo/data, client and site address, segment table and verdict; on web it opens a print window
- Edit (PUT) / duplicate saved calculations through a zustand draft store
- Installer profile tab with logo stored in Emergent Object Storage
- Tested: backend 38/38, frontend flows (iteration 2); fixes applied for edit state after delete, web print, maxLength, touch targets
- Calculator with gas/material selectors, length, fittings allowance (0–30%), appliance modal (presets + custom)
- Result: recommended diameter, Δp, flow, velocity, verification table for all sizes
- Save to history, list, detail, delete
- Tested: backend 18/18, frontend happy path

## Backlog
- P1: Medium pressure ranges, fitting-by-fitting equivalent lengths
- P2: Network diagram view, multiple installer profiles
