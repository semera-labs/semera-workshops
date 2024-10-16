const { sequelize } = require('../models');

async function initializeDatabase() {
    try {
        await sequelize.sync({ force: true });
        console.log('Database initialized successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Error initializing database:', error);
        process.exit(1);
    }
}

initializeDatabase();
