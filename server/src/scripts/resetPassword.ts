/**
 * Forgot the operator password?  Run:  npm run reset-password
 * The next visit to the dashboard asks for a new password. Events and files are untouched.
 */
import { prisma } from '../lib/prisma';
import { resetPassword } from '../services/authService';

resetPassword()
  .then(() => console.log('Operator password cleared. Open the dashboard to choose a new one.'))
  .catch((err) => {
    console.error('Could not reset the password:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
