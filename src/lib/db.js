import path from "path";
import { Sequelize } from "sequelize";

const isDev = process.env.NODE_ENV === "development";

const dbPath = isDev
    ? path.resolve("./workshop.sqlite")
    : path.join(path.dirname(process.execPath), "workshop.sqlite");

console.log("Using database path:", dbPath);

const sequelize = new Sequelize({
    dialect: "sqlite",
    storage: dbPath,
    logging: false,
});

export default sequelize;
