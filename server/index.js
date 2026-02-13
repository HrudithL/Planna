import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile } from 'fs/promises';
import dotenv from 'dotenv';
import { importCoursesFromJson } from './importCourses.js';

// Load environment variables from .env.local or .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);
const envLocalPath = join(projectRoot, '.env.local');
const envPath = join(projectRoot, '.env');

// Try .env.local first, then .env
try {
  await readFile(envLocalPath);
  dotenv.config({ path: envLocalPath });
  console.log('Loaded environment variables from .env.local');
} catch {
  try {
    await readFile(envPath);
    dotenv.config({ path: envPath });
    console.log('Loaded environment variables from .env');
  } catch {
    console.warn('No .env.local or .env file found. SUPABASE_DB_URL must be set as an environment variable.');
  }
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for large course JSON files

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Import courses from uploaded JSON (Admin only)
app.post('/api/admin/import-courses-from-json', async (req, res) => {
  try {
    console.log('Received course import request');
    
    // Validate environment variables
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        success: false,
        message: 'Server configuration error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set',
      });
    }

    // Expect JSON array directly in body
    const coursesData = req.body;

    // Validate input
    if (!Array.isArray(coursesData)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request: body must be an array of course objects',
      });
    }

    if (coursesData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request: courses array is empty',
      });
    }

    console.log(`Starting import of ${coursesData.length} courses...`);

    // Run the import
    const stats = await importCoursesFromJson(coursesData, (msg) => {
      // Progress callback - log to console
      console.log(msg);
    });

    // Return success with stats
    res.json({
      success: true,
      message: 'Course import completed successfully',
      stats: stats
    });

  } catch (error) {
    console.error('Error during course import:', error);
    res.status(500).json({
      success: false,
      message: `Import failed: ${error.message}`,
      error: error.stack
    });
  }
});

// Import courses endpoint
app.post('/api/admin/import-courses', async (req, res) => {
  try {
    // Get the path to the Python script
    const projectRoot = join(__dirname, '..');
    const scriptPath = join(projectRoot, 'data', 'import_all.py');
    
    // Verify script exists
    try {
      await readFile(scriptPath);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: `Import script not found at ${scriptPath}`,
        error: error.message,
      });
    }
    
    // Prefer the dedicated Python virtual environment under data/venv if present.
    // This keeps all scraper/import dependencies isolated inside the data pipeline.
    const venvPythonWin = join(projectRoot, 'data', 'venv', 'Scripts', 'python.exe');
    const venvPythonUnix = join(projectRoot, 'data', 'venv', 'bin', 'python');

    let pythonCmd = 'python'; // Default fallback

    try {
      // Check Windows venv first
      await readFile(venvPythonWin);
      pythonCmd = venvPythonWin;
    } catch {
      try {
        // Check Unix/Mac venv
        await readFile(venvPythonUnix);
        pythonCmd = venvPythonUnix;
      } catch {
        // Use system Python if no venv is found
        pythonCmd = 'python';
      }
    }

    console.log(`Starting course import with: ${pythonCmd} ${scriptPath}`);

    // Spawn the Python process
    const pythonProcess = spawn(pythonCmd, [scriptPath], {
      cwd: join(projectRoot, 'data'),
      env: {
        ...process.env,
        // Pass SUPABASE_DB_URL from environment if available
        SUPABASE_DB_URL: process.env.SUPABASE_DB_URL || '',
      },
      shell: true,
    });

    let stdout = '';
    let stderr = '';
    let errorOccurred = false;
    let responseSent = false;

    // Helper to send response only once
    const sendResponse = (statusCode, data) => {
      if (responseSent) {
        console.warn('Attempted to send response multiple times, ignoring');
        return;
      }
      responseSent = true;
      res.status(statusCode).json(data);
    };

    // Collect stdout
    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log('[Python stdout]', output);
    });

    // Collect stderr
    pythonProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      console.error('[Python stderr]', output);
    });

    // Handle process completion
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        // Check if database import actually happened by looking for success message in stdout
        const dbImportSuccess = stdout.includes('Database import complete') || stdout.includes('IMPORT SUMMARY');
        if (dbImportSuccess) {
          sendResponse(200, {
            success: true,
            message: 'Course import completed successfully and courses have been loaded into the database',
            output: stdout.substring(0, 5000), // Limit output size
            error: stderr || null,
          });
        } else {
          // Process completed but database import might have been skipped
          const missingDbUrl = !process.env.SUPABASE_DB_URL;
          sendResponse(200, {
            success: false,
            message: missingDbUrl 
              ? 'Import process completed but database import was skipped. SUPABASE_DB_URL environment variable is not set. Please set it in .env.local or .env file in the project root.'
              : 'Import process completed but database import was skipped. Check the output for errors.',
            output: stdout.substring(0, 5000),
            error: stderr || null,
          });
        }
      } else {
        errorOccurred = true;
        const missingDbUrl = !process.env.SUPABASE_DB_URL;
        
        // Extract the actual error from stderr or stdout
        // Prioritize stderr, show more of it, and include traceback/stack traces
        let actualError = '';
        if (stderr && stderr.trim().length > 0) {
          // Look for traceback/stack traces first (most informative)
          const tracebackMatch = stderr.match(/(Traceback.*?)(?=\n\n|\n[A-Z]|$)/s);
          if (tracebackMatch) {
            actualError = tracebackMatch[1].substring(0, 3000); // Get full traceback up to 3000 chars
          } else {
            // Look for common error patterns
            const errorLines = stderr.split('\n').filter(line => 
              line.includes('Error') || 
              line.includes('ERROR') || 
              line.includes('FATAL') ||
              line.includes('invalid') ||
              line.includes('failed') ||
              line.includes('Exception') ||
              line.includes('Traceback')
            );
            if (errorLines.length > 0) {
              // Get more error lines (up to 20) and include context
              actualError = errorLines.slice(0, 20).join('\n');
            } else {
              // No patterns found, show last 2000 chars of stderr (most recent errors)
              actualError = stderr.length > 2000 ? stderr.substring(stderr.length - 2000) : stderr;
            }
          }
        } else if (stdout) {
          // Sometimes errors are in stdout
          const errorLines = stdout.split('\n').filter(line => 
            line.includes('Error') || 
            line.includes('ERROR') || 
            line.includes('FATAL') ||
            line.includes('Exception') ||
            line.includes('Traceback')
          );
          if (errorLines.length > 0) {
            actualError = errorLines.slice(0, 20).join('\n');
          }
        }
        
        // Construct error message - prioritize actualError, fallback to stderr, then generic message
        let errorMsg = '';
        if (missingDbUrl) {
          errorMsg = `Course import failed. SUPABASE_DB_URL environment variable is not set. Please set it in .env.local or .env file in the project root. Exit code: ${code}`;
        } else if (actualError) {
          errorMsg = `Course import failed with exit code ${code}.\n\n${actualError}`;
        } else if (stderr && stderr.trim().length > 0) {
          // Fallback: show last 2000 chars of stderr
          errorMsg = `Course import failed with exit code ${code}.\n\n${stderr.length > 2000 ? stderr.substring(stderr.length - 2000) : stderr}`;
        } else {
          errorMsg = `Course import failed with exit code ${code}. Check the server logs for details.`;
        }
            
        sendResponse(500, {
          success: false,
          message: errorMsg,
          output: stdout.substring(0, 5000),
          error: stderr.substring(0, 5000) || 'No error output',
        });
      }
    });

    // Handle process errors
    pythonProcess.on('error', (error) => {
      errorOccurred = true;
      console.error('Failed to start Python process:', error);
      sendResponse(500, {
        success: false,
        message: 'Failed to start import process',
        error: error.message,
      });
    });

    // Set a timeout (45 minutes for the import - increased from 30)
    setTimeout(() => {
      if (!responseSent && !pythonProcess.killed) {
        pythonProcess.kill();
        sendResponse(500, {
          success: false,
          message: 'Import process timed out after 45 minutes',
          output: stdout,
          error: stderr,
        });
      }
    }, 45 * 60 * 1000);

  } catch (error) {
    console.error('Error starting import:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start import process',
      error: error.message,
    });
  }
});

// Get import status (check if output files exist)
app.get('/api/admin/import-status', async (req, res) => {
  try {
    const projectRoot = join(__dirname, '..');
    const outputDir = join(projectRoot, 'data', 'output');
    
    try {
      const statsFile = join(outputDir, 'statistics.json');
      const finalFile = join(outputDir, 'step5_final.json');
      
      const [statsContent, finalContent] = await Promise.all([
        readFile(statsFile, 'utf-8').catch(() => null),
        readFile(finalFile, 'utf-8').catch(() => null),
      ]);

      if (statsContent && finalContent) {
        const stats = JSON.parse(statsContent);
        const final = JSON.parse(finalContent);
        
        res.json({
          hasData: true,
          totalCourses: stats.total_courses || final.count || 0,
          lastImport: stats.lastImport || null,
          statistics: stats,
        });
      } else {
        res.json({
          hasData: false,
          message: 'No import data found',
        });
      }
    } catch (error) {
      res.json({
        hasData: false,
        error: error.message,
      });
    }
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

