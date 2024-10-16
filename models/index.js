const sequelize = require('../lib/db');
const Submission = require('./submission');
const Workshop = require('./workshop');

const db = {
    sequelize,
    Submission,
    Workshop,
};

// Synchronize the models with the database
async function initializeDatabase() {
    try {
        await sequelize.sync();
        console.log('Database synchronized successfully.');
    } catch (error) {
        console.error('Error synchronizing database:', error);
    }
}

initializeDatabase();

module.exports = db;
