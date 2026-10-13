import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import axios from "axios";

import API_BASE from "../../lib/api.js";

import {
  MAX_PREFERENCES,
  PREFERENCE_KEYS,
  WISH_LABELS,
  WISH_PLACEHOLDERS,
  emptyPreferences,
} from "../../lib/preferenceKeys.js";


const preferenceFields = PREFERENCE_KEYS.map((key, index) => ({
  key,
  label: WISH_LABELS[index],
  placeholder: WISH_PLACEHOLDERS[index],
}));


/*
 * Phones sit on a shared, sometimes weak Wi-Fi without internet. Every
 * request gets a time limit (otherwise the page just spins), and loading
 * is retried a few times before the user sees an error.
 */
const REQUEST_TIMEOUT_MS = 12000;

async function getWithRetry(url, config = {}, tries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      return await axios.get(url, {
        timeout: REQUEST_TIMEOUT_MS,
        ...config,
      });
    } catch (error) {
      lastError = error;

      // No answer at all (offline, timeout) or a server hiccup: try again.
      const retryable =
        !error.response || error.response.status >= 500;

      if (!retryable || attempt === tries) {
        break;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, 800 * attempt)
      );
    }
  }

  throw lastError;
}


/*
 * Public browser / phone:
 *
 * The Express server serves the page itself, so API calls should go
 * back to exactly the same origin.
 *
 * Electron development:
 *
 * React runs on Vite :5173 while Express runs on the configured
 * server port. API_BASE already handles that case.
 */
function getApiOrigin() {
  if (
    window.electron?.ipcRenderer &&
    window.location.port === "5173"
  ) {
    return `http://${API_BASE}`;
  }

  return window.location.origin;
}


export default function WorkshopPreferences() {
  const [name, setName] =
    useState("");

  const [
    preferences,
    setPreferences,
  ] = useState(emptyPreferences());

  /*
   * Do NOT default this to 3.
   *
   * null means:
   * "we have not received the setting from the server yet."
   *
   * This prevents a failed/stale request from silently looking
   * like the application is configured for 3 preferences.
   */
  const [
    numPreferences,
    setNumPreferences,
  ] = useState(null);

  const [
    workshops,
    setWorkshops,
  ] = useState([]);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const [
    windowHeight,
    setWindowHeight,
  ] = useState("100vh");

  // True while a submission is on its way (prevents double taps).
  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  // Changing this loads the workshops and settings again, without a page reload
  // (a reload would throw away what the user already selected).
  const [
    retryKey,
    setRetryKey,
  ] = useState(0);

  // True once the settings arrived at least once.
  const settingsLoaded = useRef(false);

  // Same as "submitting", but changes immediately (state only changes on the
  // next render), so a very fast double tap cannot send twice.
  const submittingNow = useRef(false);


  /*
   * ----------------------------------------------------------------------
   * Load workshops
   * ----------------------------------------------------------------------
   */

  useEffect(() => {
    const fetchWorkshops =
      async () => {
        try {
          const apiOrigin =
            getApiOrigin();

          const response =
            await getWithRetry(
              `${apiOrigin}/api/workshops`
            );

          setWorkshops(
            response.data
          );
        } catch (error) {
          console.error(
            "Fehler beim Abrufen der Workshops:",
            error
          );

          setError(
            "Die Workshop-Liste konnte nicht geladen werden. Bist du im richtigen WLAN?"
          );
        }
      };

    fetchWorkshops();
  }, [retryKey]);


  /*
   * ----------------------------------------------------------------------
   * Load public settings
   * ----------------------------------------------------------------------
   */

  useEffect(() => {
    let mounted = true;

    const fetchPublicSettings =
      async () => {
        try {
          const apiOrigin =
            getApiOrigin();

          /*
           * Cache-busting query parameter prevents a browser,
           * proxy or mobile webview from handing us an old
           * settings response.
           */
          const response =
            await getWithRetry(
              `${apiOrigin}/api/public-settings`,
              {
                params: {
                  _: Date.now(),
                },
              }
            );

          const rawValue =
            response.data
              ?.numPreferences;

          const configuredCount =
            Number.parseInt(
              rawValue,
              10
            );

          console.log(
            "Public settings:",
            response.data
          );

          console.log(
            "Configured preference count:",
            configuredCount
          );

          if (
            !Number.isInteger(
              configuredCount
            ) ||
            configuredCount < 1 ||
            configuredCount > MAX_PREFERENCES
          ) {
            throw new Error(
              `Invalid numPreferences received from server: ${rawValue}`
            );
          }

          if (mounted) {
            settingsLoaded.current = true;

            setNumPreferences(
              configuredCount
            );

            setError("");
          }
        } catch (error) {
          console.error(
            "Fehler beim Laden der öffentlichen Einstellungen:",
            error
          );

          /*
           * A failed refresh (the phone came back from sleep and the Wi-Fi is
           * not there yet) must not make the form disappear: the user may have
           * filled it in already. Only the very first load shows an error.
           */
          if (mounted && !settingsLoaded.current) {
            /*
             * Don't silently fall back to 3.
             * If settings cannot be loaded, show the error.
             */
            setNumPreferences(
              null
            );

            setError(
              "Die Anzahl der Workshop-Wünsche konnte nicht geladen werden."
            );
          }
        }
      };


    /*
     * Initial load.
     */
    fetchPublicSettings();


    /*
     * If the administrator changes the setting while this page
     * remains open on a phone, reload it when the user comes
     * back to the page.
     */
    const handleFocus =
      () => {
        fetchPublicSettings();
      };


    const handleVisibilityChange =
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          fetchPublicSettings();
        }
      };


    window.addEventListener(
      "focus",
      handleFocus
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );


    return () => {
      mounted = false;

      window.removeEventListener(
        "focus",
        handleFocus
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [retryKey]);


  /*
   * ----------------------------------------------------------------------
   * Window height
   * ----------------------------------------------------------------------
   */

  useEffect(() => {
    const updateHeight =
      () => {
        setWindowHeight(
          `${window.innerHeight}px`
        );
      };

    updateHeight();

    window.addEventListener(
      "resize",
      updateHeight
    );

    return () =>
      window.removeEventListener(
        "resize",
        updateHeight
      );
  }, []);


  /*
   * ----------------------------------------------------------------------
   * Preference fields enabled by server settings
   * ----------------------------------------------------------------------
   */

  const activePreferenceFields =
    numPreferences === null
      ? []
      : preferenceFields.slice(
        0,
        numPreferences
      );


  /*
   * ----------------------------------------------------------------------
   * Preference selection
   * ----------------------------------------------------------------------
   */

  const handleChange =
    (event) => {
      const {
        name,
        value,
      } = event.target;

      setPreferences(
        (previous) => ({
          ...previous,
          [name]: value,
        })
      );

      setError("");
      setSuccess("");
    };


  /*
   * ----------------------------------------------------------------------
   * Filter workshops already selected in another preference
   * ----------------------------------------------------------------------
   */

  const getFilteredWorkshops =
    (currentSelection) => {
      const activeKeys =
        activePreferenceFields.map(
          (field) =>
            field.key
        );

      const selectedWorkshops =
        activeKeys
          .map(
            (key) =>
              preferences[key]
          )
          .filter(Boolean);

      return workshops.filter(
        (workshop) =>
          !selectedWorkshops.includes(
            workshop.title
          ) ||
          workshop.title ===
          currentSelection
      );
    };


  /*
   * ----------------------------------------------------------------------
   * Submit
   * ----------------------------------------------------------------------
   */

  const handleSubmit =
    async (event) => {
      event.preventDefault();

      if (submitting || submittingNow.current) {
        return;
      }

      setError("");
      setSuccess("");

      if (
        numPreferences ===
        null
      ) {
        setError(
          "Die Einstellungen wurden noch nicht geladen."
        );

        return;
      }


      const activeValues =
        activePreferenceFields.map(
          ({ key }) =>
            preferences[key]
        );


      /*
       * Every configured preference is required.
       */
      if (
        activeValues.some(
          (value) =>
            !value
        )
      ) {
        setError(
          "Bitte alle Wünsche auswählen."
        );

        return;
      }


      /*
       * Preferences must be unique.
       */
      const uniqueValues =
        new Set(
          activeValues
        );

      if (
        uniqueValues.size !==
        activeValues.length
      ) {
        setError(
          "Jeder Wunsch muss verschieden sein."
        );

        return;
      }


      /*
       * Keep a consistent object with all wish fields for the backend.
       * Fields disabled in settings remain empty.
       */
      const submittedPreferences = emptyPreferences();


      activePreferenceFields.forEach(
        ({ key }) => {
          submittedPreferences[
            key
          ] =
            preferences[key];
        }
      );


      submittingNow.current = true;
      setSubmitting(true);

      try {
        const apiOrigin =
          getApiOrigin();

        await axios.post(
          `${apiOrigin}/api/preferences`,
          {
            name:
              name.trim(),

            preferences:
              submittedPreferences,
          },
          {
            timeout: REQUEST_TIMEOUT_MS,
          }
        );

        setSuccess(
          "Wünsche erfolgreich übertragen!"
        );

        setError("");
      } catch (error) {
        console.error(
          "Fehler beim Senden der Wünsche:",
          error
        );

        if (
          error.response
            ?.status ===
          409
        ) {
          setError(
            "Du hast deine Wünsche bereits eingereicht."
          );

          window.alert(
            "Du hast deine Wünsche bereits eingereicht."
          );
        } else if (!error.response) {
          /*
           * No answer at all: offline, out of Wi-Fi range or too slow. The
           * submission may even have arrived. Sending again is safe: the
           * same wishes under the same name are recognised as already saved.
           */
          setError(
            "Keine Verbindung zum Server. Deine Auswahl ist noch da. Prüfe das WLAN und tippe noch einmal auf „Auswahl abschicken“. Doppelt senden schadet nicht."
          );
        } else {
          setError(
            error.response.data?.message ||
            "Fehler beim Senden der Wünsche."
          );
        }

        setSuccess("");
      } finally {
        submittingNow.current = false;
        setSubmitting(false);
      }
    };


  /*
   * ----------------------------------------------------------------------
   * Loading state
   * ----------------------------------------------------------------------
   */

  if (
    numPreferences === null &&
    !error
  ) {
    return (
      <div
        style={{
          minHeight:
            windowHeight,
        }}
        className="flex items-center justify-center bg-gray-100 p-4"
      >
        <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-lg text-center">

          <h2 className="text-2xl font-bold mb-4">
            Workshop Auswahl
          </h2>

          <p className="text-gray-500">
            Einstellungen werden geladen…
          </p>

        </div>
      </div>
    );
  }


  return (
    <div
      style={{
        minHeight:
          windowHeight,
      }}
      className="flex items-center justify-center bg-gray-100 p-4"
    >
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-lg">

        <h2 className="text-2xl font-bold mb-2 text-center">
          Workshop Auswahl
        </h2>


        {numPreferences !==
          null && (
            <p className="text-sm text-gray-500 text-center mb-6">
              Bitte wähle{" "}
              <strong>
                {
                  numPreferences
                }
              </strong>{" "}
              {numPreferences ===
                1
                ? "Wunsch"
                : "Wünsche"}{" "}
              in der gewünschten
              Reihenfolge aus.
            </p>
          )}


        {error &&
          numPreferences ===
          null && (
            <div className="mb-4">

              <p className="text-red-500">
                {error}
              </p>

              <button
                type="button"
                onClick={() => {
                  setError("");
                  setRetryKey((key) => key + 1);
                }}
                className="mt-3 w-full bg-gray-500 text-white p-2 rounded-md hover:bg-gray-600"
              >
                Erneut versuchen
              </button>

            </div>
          )}


        {numPreferences !==
          null && (
            <form
              onSubmit={
                handleSubmit
              }
              className="space-y-4"
            >

              {workshops.length === 0 && (
                <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                  Die Workshop-Liste ist noch leer.
                  {" "}
                  <button
                    type="button"
                    className="underline font-medium"
                    onClick={() =>
                      setRetryKey((key) => key + 1)
                    }
                  >
                    Neu laden
                  </button>
                </div>
              )}

              {/* Name */}

              <div className="flex flex-col space-y-2">

                <label
                  htmlFor="name"
                  className="text-gray-700 font-medium"
                >
                  Name
                </label>

                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(
                    event
                  ) =>
                    setName(
                      event
                        .target
                        .value
                    )
                  }
                  required
                  className="p-2 border rounded-md w-full"
                />

              </div>


              {/* Dynamic preferences */}

              {activePreferenceFields.map(
                ({
                  key,
                  label,
                  placeholder,
                }) => (
                  <div
                    key={key}
                    className="flex flex-col space-y-2"
                  >

                    <label
                      htmlFor={`preference-${key}`}
                      className="text-gray-700 font-medium"
                    >
                      {label}
                    </label>

                    <select
                      id={`preference-${key}`}
                      name={key}
                      value={
                        preferences[
                        key
                        ]
                      }
                      onChange={
                        handleChange
                      }
                      required
                      className="p-2 border rounded-md w-full"
                    >

                      <option value="">
                        {
                          placeholder
                        }
                      </option>


                      {getFilteredWorkshops(
                        preferences[
                        key
                        ]
                      ).map(
                        (
                          workshop
                        ) => (
                          <option
                            key={
                              workshop.id
                            }
                            value={
                              workshop.title
                            }
                          >
                            {
                              workshop.title
                            }
                          </option>
                        )
                      )}

                    </select>

                  </div>
                )
              )}


              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600 transition duration-300 disabled:opacity-60"
              >
                {submitting
                  ? "Wird gesendet …"
                  : "Auswahl abschicken"}
              </button>


              {error && (
                <p className="text-red-500 mt-4">
                  {error}
                </p>
              )}


              {success && (
                <p className="text-green-500 mt-4">
                  {success}
                </p>
              )}

            </form>
          )}

      </div>
    </div>
  );
}
