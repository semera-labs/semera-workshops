const fs = require('fs');
const path = require('path');
const { Workshop } = require('../models');

async function initWorkshops() {
    try {
        const workshopsFilePath = path.join(__dirname, '../data/workshops.json');
        const workshopsData = JSON.parse(fs.readFileSync(workshopsFilePath, 'utf8'));

        // Clear existing workshops
        await Workshop.destroy({ where: {} });

        // Insert workshops into the database
        await Workshop.bulkCreate(workshopsData);

        console.log('Workshops initialized successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Error initializing workshops:', error);
        process.exit(1);
    }
}

initWorkshops();
