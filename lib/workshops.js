const { Workshop } = require('../models');

async function getAllWorkshops() {
    return await Workshop.findAll();
}

async function setWorkshops(newWorkshops) {
    // Delete existing workshops
    await Workshop.destroy({ where: {} });
    // Bulk create new workshops
    await Workshop.bulkCreate(newWorkshops);
}

module.exports = {
    getAllWorkshops,
    setWorkshops,
};