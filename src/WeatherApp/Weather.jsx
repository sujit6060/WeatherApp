import React, { useEffect, useMemo, useState } from "react";
import "./style.css";

const DEFAULT_LOCATION = {
  name: "Pune",
  admin1: "Maharashtra",
  country: "India",
  latitude: 18.5204,
  longitude: 73.8567,
};

const weatherDescriptions = {
  0: ["Clear sky", "☀️"],
  1: ["Mainly clear", "🌤️"],
  2: ["Partly cloudy", "⛅"],
  3: ["Overcast", "☁️"],
  45: ["Foggy", "🌫️"],
  48: ["Rime fog", "🌫️"],
  51: ["Light drizzle", "🌦️"],
  53: ["Drizzle", "🌦️"],
  55: ["Heavy drizzle", "🌧️"],
  56: ["Freezing drizzle", "🌧️"],
  57: ["Freezing drizzle", "🌧️"],
  61: ["Light rain", "🌦️"],
  63: ["Rain", "🌧️"],
  65: ["Heavy rain", "🌧️"],
  66: ["Freezing rain", "🌧️"],
  67: ["Freezing rain", "🌧️"],
  71: ["Light snow", "🌨️"],
  73: ["Snow", "🌨️"],
  75: ["Heavy snow", "❄️"],
  77: ["Snow grains", "❄️"],
  80: ["Rain showers", "🌦️"],
  81: ["Rain showers", "🌧️"],
  82: ["Heavy showers", "🌧️"],
  85: ["Snow showers", "🌨️"],
  86: ["Heavy snow showers", "❄️"],
  95: ["Thunderstorm", "⛈️"],
  96: ["Thunderstorm & hail", "⛈️"],
  99: ["Thunderstorm & hail", "⛈️"],
};

const describeWeather = (code) => weatherDescriptions[code] || ["Weather", "⛅"];

const getStoredFavorites = () => {
  try {
    const favorites = JSON.parse(localStorage.getItem("aeris-favorites") || "[]");
    return Array.isArray(favorites) ? favorites : [];
  } catch (error) {
    console.error("Could not read saved locations:", error);
    return [];
  }
};

const formatHour = (time) => {
  const hour = Number(time.split("T")[1].slice(0, 2));
  return `${hour % 12 || 12}${hour >= 12 ? "pm" : "am"}`;
};

const formatDay = (date) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("en", { weekday: "short" });

const formatDate = (date) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

const formatTemperature = (value) => Math.round(value);

export const Weather = () => {
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [weather, setWeather] = useState(null);
  const [query, setQuery] = useState("");
  const [unit, setUnit] = useState("celsius");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [favorites, setFavorites] = useState(getStoredFavorites);

  useEffect(() => {
    const controller = new AbortController();
    const loadWeather = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          latitude: location.latitude,
          longitude: location.longitude,
          current:
            "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m",
          hourly: "temperature_2m,precipitation_probability,weather_code",
          daily:
            "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max",
          temperature_unit: unit,
          wind_speed_unit: "kmh",
          precipitation_unit: "mm",
          timezone: "auto",
          forecast_days: "7",
        });
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?${params}`,
          { signal: controller.signal }
        );
        if (!response.ok) {
          throw new Error("Weather data is temporarily unavailable. Please try again.");
        }
        const data = await response.json();
        if (!data.current || !data.daily || !data.hourly) {
          throw new Error("The weather service returned incomplete data.");
        }
        setWeather(data);
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          console.error("Error fetching weather data:", requestError);
          setError(requestError.message || "Could not load weather right now.");
          setWeather(null);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    loadWeather();
    return () => controller.abort();
  }, [location, unit]);

  const hourlyForecast = useMemo(() => {
    if (!weather) return [];
    const currentHour = weather.current.time;
    const start = weather.hourly.time.findIndex((time) => time >= currentHour);
    return weather.hourly.time
      .slice(Math.max(0, start), Math.max(0, start) + 7)
      .map((time, index) => {
        const hourIndex = Math.max(0, start) + index;
        return {
          time,
          temperature: weather.hourly.temperature_2m[hourIndex],
          precipitation: weather.hourly.precipitation_probability[hourIndex],
          code: weather.hourly.weather_code[hourIndex],
        };
      });
  }, [weather]);

  const submitSearch = async (event) => {
    event.preventDefault();
    const cityName = query.trim();
    if (!cityName || searching) return;
    setSearching(true);
    setError("");
    try {
      const params = new URLSearchParams({
        name: cityName,
        count: "1",
        language: "en",
        format: "json",
      });
      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?${params}`
      );
      if (!response.ok) throw new Error("City search is unavailable. Please try again.");
      const result = await response.json();
      if (!result.results || result.results.length === 0) {
        throw new Error(`We couldn't find "${cityName}". Try another city.`);
      }
      setLocation(result.results[0]);
      setQuery("");
    } catch (searchError) {
      console.error("Error searching for a city:", searchError);
      setError(searchError.message || "Could not search for that city.");
    } finally {
      setSearching(false);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Location services aren't supported by this browser.");
      return;
    }
    setError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation({
          name: "Your location",
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
      },
      (locationError) => {
        const message =
          locationError.code === 1
            ? "Allow location access in your browser to use this feature."
            : "Your location couldn't be determined. Please try again.";
        setError(message);
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  const isFavorite = favorites.some(
    (favorite) =>
      favorite.latitude === location.latitude &&
      favorite.longitude === location.longitude
  );

  const toggleFavorite = () => {
    const nextFavorites = isFavorite
      ? favorites.filter(
          (favorite) =>
            favorite.latitude !== location.latitude ||
            favorite.longitude !== location.longitude
        )
      : [
          ...favorites,
          {
            name: location.name,
            admin1: location.admin1,
            country: location.country,
            latitude: location.latitude,
            longitude: location.longitude,
          },
        ];
    setFavorites(nextFavorites);
    try {
      localStorage.setItem("aeris-favorites", JSON.stringify(nextFavorites));
    } catch (storageError) {
      console.error("Could not save favorite locations:", storageError);
      setError("Your browser couldn't save this location.");
    }
  };

  const current = weather && weather.current;
  const [condition, conditionIcon] = current
    ? describeWeather(current.weather_code)
    : ["", "⛅"];
  const currentDate = current ? current.time.split("T")[0] : "";
  const tempUnit = unit === "celsius" ? "°" : "°";

  return (
    <div className="weather-app">
      <div className="weather-shell">
        <header className="topbar">
          <a className="brand" href="/" aria-label="Sujeet home">
            <span className="brand-mark" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span>SUJEET<span className="brand-period">.</span></span>
          </a>
          <div className="topbar-meta">
            <span className="live-indicator" />
            <span>LIVE WEATHER</span>
          </div>
          <div className="topbar-actions">
            <form className="search-form" onSubmit={submitSearch}>
              <span className="search-icon" aria-hidden="true">⌕</span>
              <input
                aria-label="Search city"
                type="search"
                placeholder="Search a city..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button
                className="search-submit"
                type="submit"
                disabled={!query.trim() || searching}
                aria-label="Search"
              >
                {searching ? "…" : "↵"}
              </button>
            </form>
            <button
              className="icon-button location-button"
              type="button"
              onClick={useCurrentLocation}
              aria-label="Use my current location"
              title="Use my current location"
            >
              ◎
            </button>
            <div className="unit-switch" aria-label="Temperature units">
              <button
                type="button"
                className={unit === "celsius" ? "active" : ""}
                onClick={() => setUnit("celsius")}
                aria-pressed={unit === "celsius"}
              >
                °C
              </button>
              <button
                type="button"
                className={unit === "fahrenheit" ? "active" : ""}
                onClick={() => setUnit("fahrenheit")}
                aria-pressed={unit === "fahrenheit"}
              >
                °F
              </button>
            </div>
          </div>
        </header>

        <main>
          <section className="welcome-row">
            <div>
              <p className="eyebrow">YOUR PERSONAL WEATHER STATION</p>
              <h1>Weather, <span>beautifully</span> told.</h1>
            </div>
            <div className="date-display">
              <span className="date-dot" />
              {currentDate ? formatDate(currentDate) : "A little forecast for your day"}
            </div>
          </section>

          {error && (
            <div className="error-banner" role="alert">
              <span aria-hidden="true">!</span>
              {error}
              <button type="button" onClick={() => setError("")} aria-label="Dismiss message">×</button>
            </div>
          )}

          <section className={`hero-card${loading ? " is-loading" : ""}`}>
            {loading && <div className="loading-line" />}
            <div className="hero-copy">
              <div className="location-label">
                <span aria-hidden="true">⌖</span>
                {location.name}
                {location.admin1 ? `, ${location.admin1}` : ""}
                {location.country ? ` · ${location.country}` : ""}
              </div>
              {current ? (
                <>
                  <div className="hero-temperature">
                    {formatTemperature(current.temperature_2m)}
                    <span>{tempUnit}</span>
                  </div>
                  <div className="hero-condition">{condition}</div>
                  <p className="hero-summary">
                    Feels like {formatTemperature(current.apparent_temperature)}{tempUnit}
                    <span className="summary-divider">/</span>
                    H:{formatTemperature(weather.daily.temperature_2m_max[0])}°
                    <span className="summary-divider">·</span>
                    L:{formatTemperature(weather.daily.temperature_2m_min[0])}°
                  </p>
                </>
              ) : (
                <div className="hero-loading-copy">
                  <div className="skeleton skeleton-temperature" />
                  <div className="skeleton skeleton-caption" />
                </div>
              )}
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="sun-glow" />
              <div className="sun-disc">{conditionIcon}</div>
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <span className="sparkle sparkle-one">✳</span>
              <span className="sparkle sparkle-two">✦</span>
            </div>
            <div className="hero-footer">
              <div className="hero-footer-note">
                <span className="weather-pulse" />
                {current ? "Conditions right now" : error ? "Weather unavailable" : "Finding your forecast"}
              </div>
              <button
                className={`favorite-button${isFavorite ? " favorited" : ""}`}
                type="button"
                onClick={toggleFavorite}
                aria-label={isFavorite ? "Remove saved location" : "Save this location"}
                title={isFavorite ? "Remove saved location" : "Save this location"}
              >
                <span>{isFavorite ? "★" : "☆"}</span>
                <span>{isFavorite ? "Saved" : "Save place"}</span>
              </button>
            </div>
          </section>

          <section className="conditions-grid" aria-label="Current conditions">
            <article className="condition-card">
              <div className="condition-icon feels-icon">↗</div>
              <div className="condition-label">FEELS LIKE</div>
              <div className="condition-value">
                {current ? `${formatTemperature(current.apparent_temperature)}${tempUnit}` : "—"}
              </div>
              <div className="condition-detail">The way it feels outside</div>
            </article>
            <article className="condition-card">
              <div className="condition-icon humidity-icon">◌</div>
              <div className="condition-label">HUMIDITY</div>
              <div className="condition-value">
                {current ? `${Math.round(current.relative_humidity_2m)}%` : "—"}
              </div>
              <div className="condition-detail">Relative humidity</div>
            </article>
            <article className="condition-card">
              <div className="condition-icon wind-icon">≋</div>
              <div className="condition-label">WIND</div>
              <div className="condition-value">
                {current ? `${Math.round(current.wind_speed_10m)} <small>km/h</small>` : "—"}
              </div>
              <div className="condition-detail">Steady breeze</div>
            </article>
            <article className="condition-card">
              <div className="condition-icon uv-icon">◉</div>
              <div className="condition-label">UV INDEX</div>
              <div className="condition-value">
                {weather ? weather.daily.uv_index_max[0].toFixed(1) : "—"}
              </div>
              <div className="condition-detail">Today's peak</div>
            </article>
          </section>

          <section className="forecast-section hourly-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">THE NEXT FEW HOURS</p>
                <h2>On the horizon</h2>
              </div>
              <span className="section-side-note">NEXT 7 HOURS <span>↗</span></span>
            </div>
            <div className="hourly-list">
              {hourlyForecast.length ? (
                hourlyForecast.map((hour, index) => (
                  <article className={`hour-card${index === 0 ? " hour-now" : ""}`} key={hour.time}>
                    <span className="hour-time">{index === 0 ? "Now" : formatHour(hour.time)}</span>
                    <span className="hour-weather" role="img" aria-label={describeWeather(hour.code)[0]}>
                      {describeWeather(hour.code)[1]}
                    </span>
                    <span className="hour-temp">{formatTemperature(hour.temperature)}°</span>
                    <span className="hour-rain">{hour.precipitation}% <span>rain</span></span>
                  </article>
                ))
              ) : (
                <div className="forecast-empty">{loading ? "Loading the hourly forecast..." : "Hourly forecast is unavailable."}</div>
              )}
            </div>
          </section>

          <section className="bottom-grid">
            <div className="forecast-section weekly-section">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">PLAN AHEAD</p>
                  <h2>7-day forecast</h2>
                </div>
                <span className="section-side-note">THIS WEEK</span>
              </div>
              <div className="daily-list">
                {weather
                  ? weather.daily.time.map((date, index) => {
                      const [description, icon] = describeWeather(weather.daily.weather_code[index]);
                      return (
                        <article className="day-row" key={date}>
                          <span className="day-name">{index === 0 ? "Today" : formatDay(date)}</span>
                          <span className="day-icon" role="img" aria-label={description}>{icon}</span>
                          <span className="day-condition">{description}</span>
                          <span className="day-high">{formatTemperature(weather.daily.temperature_2m_max[index])}°</span>
                          <div className="temperature-range">
                            <span style={{ left: `${Math.max(0, Math.min(100, (weather.daily.temperature_2m_min[index] + 10) * 2))}%` }} />
                          </div>
                          <span className="day-low">{formatTemperature(weather.daily.temperature_2m_min[index])}°</span>
                        </article>
                      );
                    })
                  : <div className="forecast-empty">{loading ? "Loading the week ahead..." : "The weekly forecast is unavailable."}</div>}
              </div>
            </div>

            <aside className="side-column">
              <section className="sun-card">
                <div className="side-card-heading">
                  <div>
                    <p className="eyebrow">DAYLIGHT</p>
                    <h2>Sun tracker</h2>
                  </div>
                  <span className="sun-symbol" aria-hidden="true">☼</span>
                </div>
                {weather ? (
                  <>
                    <div className="sun-times">
                      <div><span>SUNRISE</span><strong>{formatHour(weather.daily.sunrise[0])}</strong></div>
                      <div className="sunset-time"><span>SUNSET</span><strong>{formatHour(weather.daily.sunset[0])}</strong></div>
                    </div>
                    <div className="sun-path"><span className="sun-path-dot" /></div>
                    <div className="sun-caption">Make the most of the daylight</div>
                  </>
                ) : <div className="forecast-empty">{loading ? "Loading daylight..." : "Daylight data unavailable."}</div>}
              </section>

              <section className="saved-card">
                <div className="side-card-heading">
                  <div>
                    <p className="eyebrow">YOUR PLACES</p>
                    <h2>Saved locations</h2>
                  </div>
                  <span className="saved-count">{favorites.length.toString().padStart(2, "0")}</span>
                </div>
                {favorites.length ? (
                  <div className="saved-list">
                    {favorites.map((favorite) => (
                      <button
                        className={`saved-place${favorite.latitude === location.latitude && favorite.longitude === location.longitude ? " current-place" : ""}`}
                        type="button"
                        key={`${favorite.latitude}-${favorite.longitude}`}
                        onClick={() => setLocation(favorite)}
                      >
                        <span className="saved-place-pin">⌖</span>
                        <span className="saved-place-name">{favorite.name}<small>{favorite.admin1 || favorite.country || "Saved place"}</small></span>
                        <span className="saved-place-arrow">↗</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="saved-empty">Save a place with the star to keep its forecast close.</p>
                )}
              </section>
            </aside>
          </section>
        </main>

        <footer className="app-footer">
          <span>Thoughtful forecasts, wherever you are.</span>
          <span>WEATHER DATA BY OPEN-METEO <span className="footer-sparkle">✳</span></span>
        </footer>
      </div>
    </div>
  );
};
