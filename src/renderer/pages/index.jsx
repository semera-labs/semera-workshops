import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import API_BASE from "../../lib/api.js";

export default function WorkshopPreferences() {
  const [name, setName] = useState('');
  const [preferences, setPreferences] = useState({
    first: '',
    second: '',
    third: '',
  });
  const [workshops, setWorkshops] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [windowHeight, setWindowHeight] = useState('100vh');

  // Workshops vom Server abrufen
  useEffect(() => {
    const fetchWorkshops = async () => {
      try {
        const response = await axios.get(`http://${API_BASE}/api/workshops`);
        setWorkshops(response.data);
      } catch (error) {
        console.error('Fehler beim Abrufen der Workshops:', error);
        setError('Fehler beim Laden der Workshops.');
      }
    };

    fetchWorkshops();
  }, []);

  useEffect(() => {
    const updateHeight = () => {
      setWindowHeight(`${window.innerHeight}px`);
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (preferences.first === preferences.second || preferences.first === preferences.third || preferences.second === preferences.third) {
      setError('Jeder Wunsch muss verschieden sein.');
      setSuccess('');
      return;
    }

    try {
      await axios.post(`http://${API_BASE}/api/preferences`, {
        name: name.trim(),
        preferences,
      });
      setSuccess('Wünsche erfolgreich übertragen!');
      setError('');
      //setName('');
      //setPreferences({ first: '', second: '', third: '' });
    } catch (error) {
      if (error.response?.status === 409) {
        setError('Du hast deine Wünsche bereits eingereicht.');
        window.alert('Du hast deine Wünsche bereits eingereicht.');
      } else {
        setError('Fehler beim Senden der Wünsche.');
      }
      setSuccess('');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setPreferences((prev) => ({ ...prev, [name]: value }));
  };

  const getFilteredWorkshops = (currentSelection) => {
    return workshops.filter(
      (workshop) => !Object.values(preferences).includes(workshop.title) || workshop.title === currentSelection
    );
  };

  return (
    <>
      <div style={{ height: windowHeight }}
        className="flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-lg">
          <h2 className="text-2xl font-bold mb-6 text-center">Workshop Auswahl</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col space-y-2">
              <label htmlFor="name" className="text-gray-700 font-medium">Name</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="p-2 border rounded-md w-full"
              />
            </div>

            <div className="flex flex-col space-y-2">
              <label htmlFor="firstPreference" className="text-gray-700 font-medium">Erster Wunsch</label>
              <select
                id="firstPreference"
                name="first"
                value={preferences.first}
                onChange={handleChange}
                required
                className="p-2 border rounded-md w-full"
              >
                <option value="">Ersten Wunsch auswählen</option>
                {getFilteredWorkshops(preferences.first).map((workshop) => (
                  <option key={workshop.id} value={workshop.title}>
                    {workshop.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col space-y-2">
              <label htmlFor="secondPreference" className="text-gray-700 font-medium">Zweiter Wunsch</label>
              <select
                id="secondPreference"
                name="second"
                value={preferences.second}
                onChange={handleChange}
                required
                className="p-2 border rounded-md w-full"
              >
                <option value="">Zweiten Wunsch auswählen</option>
                {getFilteredWorkshops(preferences.second).map((workshop) => (
                  <option key={workshop.id} value={workshop.title}>
                    {workshop.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col space-y-2">
              <label htmlFor="thirdPreference" className="text-gray-700 font-medium">Dritter Wunsch</label>
              <select
                id="thirdPreference"
                name="third"
                value={preferences.third}
                onChange={handleChange}
                required
                className="p-2 border rounded-md w-full"
              >
                <option value="">Dritten Wunsch auswählen</option>
                {getFilteredWorkshops(preferences.third).map((workshop) => (
                  <option key={workshop.id} value={workshop.title}>
                    {workshop.title}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600 transition duration-300"
            >
              Auswahl abschicken
            </button>
            {error && <p className="text-red-500 mt-4">{error}</p>}
            {success && <p className="text-green-500 mt-4">{success}</p>}
          </form>
        </div>
      </div>
    </>
  );
}
