import {config} from "../server/config"

const API_BASE =
    window.location.hostname === "localhost"
        ? `localhost:${config.port}`
        : `${window.location.hostname}:${config.port}`;

export default API_BASE;
