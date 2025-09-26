const API_BASE =
    window.location.hostname === "localhost"
        ? "localhost:3001"
        : `${window.location.hostname}:3001`;

export default API_BASE;
