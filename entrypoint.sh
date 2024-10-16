#!/bin/sh

# Initialize the database
node scripts/initDatabase.js

# Initialize the workshops (if needed)
node scripts/initWorkshops.js

# Start the application
npm run start
