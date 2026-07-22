# WX

Terminal-style hourly weather PWA. Green phosphor CRT aesthetic, matched to P1.
Data: Open-Meteo (free, no API key). No build step — plain static files at repo root.

- FORECAST: 7-day list; tap a day to drop down its hourly table
  (hour, temp, rain mm, rain %, wind, condition). Today open by default.
- RAIN: precipitation graph, time (X) vs mm/h (Y), 48h / 7-day toggle.
- Location: geolocation -> saved fallback -> city search.
- Offline: app shell cached by service worker; last forecast cached and
  shown with a staleness warning in the status strip.
