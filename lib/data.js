const { Submission } = require('../models');

async function getAllSubmissions() {
    return await Submission.findAll();
}

async function saveSubmission(newSubmission) {
    await Submission.create(newSubmission);
}

async function updateSubmissionById(id, updatedSubmission) {
    try {
        const submission = await Submission.findByPk(id);

        if (submission) {
            console.log('Updating submission with ID:', id);
            console.log('New submission data:', updatedSubmission);

            await submission.update(updatedSubmission);
            console.log('Submission updated successfully.');
        } else {
            console.error(`Submission with ID ${id} not found.`);
            throw new Error('Submission not found.');
        }
    } catch (error) {
        console.error('Error updating submission:', error);
        throw error;
    }
}

async function saveImportedData(newSubmissions) {
    // Delete existing workshops
    await Submission.destroy({ where: {} });
    // Bulk create new workshops
    await Submission.bulkCreate(newSubmissions);
}

module.exports = {
    getAllSubmissions,
    saveSubmission,
    updateSubmissionById,
    saveImportedData,
};