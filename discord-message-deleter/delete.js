import 'dotenv/config'; // Loads .env variables automatically
import { fetch } from 'undici';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url'; // Needed to get __dirname in ESM

// --- Calculate __dirname in ESM ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const INPUT_FILE = 'found_messages.json';
const BASE_URL = 'https://discord.com/api/v9';
const DELETE_DELAY_MS = 1500; // Delay between delete requests (ms) - INCREASE if rate limited often
const RETRY_DELAY_BASE_MS = 5000; // Base delay for retrying after non-429 errors

// --- Validate Configuration ---
if (!DISCORD_TOKEN) {
    console.error('Error: Missing environment variable. Ensure DISCORD_TOKEN is set in your .env file.');
    process.exit(1); // Exit if token is missing
}

// --- Warning about User Tokens ---
if (!DISCORD_TOKEN.startsWith('Bot ')) {
    console.warn(
        '\n******************** WARNING ********************\n' +
            'The provided DISCORD_TOKEN does not appear to be a Bot token.\n' +
            'AUTOMATING USER ACCOUNTS (SELF-BOTTING) TO DELETE MESSAGES IS\n' +
            "HIGHLY RISKY AND AGAINST DISCORD'S TERMS OF SERVICE.\n" +
            'THIS CAN LEAD TO ACCOUNT TERMINATION. PROCEED WITH EXTREME CAUTION.\n' +
            'THERE IS NO UNDO FOR DELETED MESSAGES.\n' +
            '***********************************************\n',
    );
    // Optional: Add a small delay to force reading the warning
    await new Promise((resolve) => setTimeout(resolve, 3000));
}

// --- Fetch Headers ---
// Minimal headers for deletion
const headers = {
    accept: '*/*',
    'accept-language': 'en-US,en;q=0.9',
    authorization: DISCORD_TOKEN,
    priority: 'u=1, i',
    'sec-ch-ua': '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'x-debug-options': 'bugReporterEnabled',
    'x-discord-locale': 'en-US',
    'x-discord-timezone': 'Asia/Karachi',
    'x-super-properties': Buffer.from(
        JSON.stringify({
            os: 'Windows',
            browser: 'Chrome',
            device: '',
            system_locale: 'en-US',
            has_client_mods: false,
            browser_user_agent:
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
            browser_version: '135.0.0.0',
            os_version: '10',
            referrer: '',
            referring_domain: '',
            referrer_current: '',
            referring_domain_current: '',
            release_channel: 'stable',
            client_build_number: 389004,
            client_event_source: null,
        }),
    ).toString('base64'),
    cookie: '__dcfduid=e1bc3e7017c211f0977b67ad8c404a9e; __sdcfduid=e1bc3e7117c211f0977b67ad8c404a9ed630df4b0cebcaaf8b86325fc8eb83de89b29a256d4dfe45a8b238a8af1f5aca; _gcl_au=1.1.481788898.1744478623; _ga=GA1.1.1150671889.1744478623; __cfruid=c117d71e0815f9410cad4bc3ed4e220dbd2a1e7c-1744563362; _cfuvid=yag0iwWP_JzsbLpTUsl8Ew6u3lNSCmiLnhqKZAXq6W0-1744563362343-0.0.1.1-604800000; locale=en-US; cf_clearance=ED_Rap38p6XgLbtsfykxzNXMfhhPYvsC.dsxztAKEo4-1744563364-1.2.1.1-iXMoeDpHLjdFUVUd1wctqy9AzRvzGZ80lLUfnZC65j4UBiqQu6jfZEeT3HQJ2bNLGLVey5BBXhJjDXPlXXldAgGHgTB9iAiyVupdS4z3d9aWGCG0ZhJhT9yiFVUKD1QZ5zUaSCX_5r2R0Xo.NcEZPsTxLbYnX6srxZnmr6uHb4DkEpwfB7Gonf9FEo.XZ1aH9VDmjl4fRbXgQCaUrm353Q8HryzlOiVPUgRCWq4v57IMEASr2eU3qf_mId3wgdrx6h.i94d1NsqZasty5PgEitlJMQ6_p9dvdUtAXLpWozh0IFH_Ad0wmVv9B2Z8LM6ptiP0vsgkOfYlg7Pb1S3CC2gTXH0SeLG2ZOkbBHp_2LI; OptanonConsent=isGpcEnabled=0&datestamp=Sun+Apr+13+2025+21%3A56%3A06+GMT%2B0500+(Pakistan+Standard+Time)&version=202501.2.0&browserGpcFlag=0&isIABGlobal=false&hosts=&landingPath=https%3A%2F%2Fdiscord.com%2F&groups=C0001%3A1%2CC0002%3A1%2CC0003%3A1%2CC0004%3A1; _ga_Q149DFWHT7=GS1.1.1744563367.3.0.1744563367.0.0.0',
};

/**
 * Attempts to delete a single Discord message. Handles rate limits and retries.
 * @param {string} channelId The ID of the channel containing the message.
 * @param {string} messageId The ID of the message to delete.
 * @returns {Promise<{success: boolean, skipped: boolean, error?: string}>} Status of the deletion attempt.
 */
async function deleteMessage(channelId, messageId) {
    const url = `${BASE_URL}/channels/${channelId}/messages/${messageId}`;
    let attempt = 0;
    const maxAttempts = 3; // Max retries for non-429 errors

    while (attempt < maxAttempts) {
        attempt++;
        console.log(`   Attempt ${attempt}/${maxAttempts} to delete message ${messageId} in channel ${channelId}...`);
        try {
            const response = await fetch(url, {
                method: 'DELETE',
                headers: headers,
            });

            // --- Handle Response Status ---
            if (response.status === 204) {
                // Success (No Content)
                console.log(`   ✅ Successfully deleted message ${messageId}`);
                return { success: true, skipped: false };
            } else if (response.status === 429) {
                // Rate Limited
                const retryAfterHeader = response.headers.get('retry-after');
                let waitMs = DELETE_DELAY_MS * 2; // Default wait if header missing
                try {
                    const rateLimitBody = await response.json();
                    if (rateLimitBody.retry_after) {
                        waitMs = Math.ceil(rateLimitBody.retry_after * 1000);
                    }
                    console.warn(`   ⚠️ Rate limited (429). Body: ${JSON.stringify(rateLimitBody)}`);
                } catch (e) {
                    console.warn('   ⚠️ Rate limited (429). Could not parse body.');
                }
                if (retryAfterHeader) {
                    waitMs = parseInt(retryAfterHeader, 10) * 1000;
                }

                waitMs = Math.max(waitMs, DELETE_DELAY_MS); // Ensure minimum wait
                console.warn(`   ⏳ Rate limited. Waiting ${waitMs / 1000} seconds before retrying same message...`);
                await new Promise((resolve) => setTimeout(resolve, waitMs));
                attempt--; // Decrement attempt count because this was a rate limit retry, not a failure retry
                continue; // Retry the same message
            } else if (response.status === 404) {
                // Not Found
                console.log(`   🤷 Message ${messageId} not found (404). Already deleted or invalid ID. Skipping.`);
                return { success: false, skipped: true }; // Treat as skipped
            } else if (response.status === 403) {
                // Forbidden
                console.error(`   ❌ Forbidden (403) to delete message ${messageId}. Check token/permissions.`);
                return { success: false, skipped: false, error: 'Forbidden (403)' }; // Fatal error for this message
            } else if (response.status === 401) {
                // Unauthorized
                console.error(`   ❌ Unauthorized (401). Invalid token.`);
                throw new Error('Unauthorized (401). Stopping script.'); // Throw to stop the whole script
            } else {
                // Other Errors (e.g., 5xx Server Errors)
                const errorBody = await response.text();
                console.error(`   ❌ Error deleting message ${messageId}: ${response.status} ${response.statusText}`);
                console.error(`   Response body: ${errorBody}`);
                if (attempt >= maxAttempts) {
                    return {
                        success: false,
                        skipped: false,
                        error: `Failed after ${maxAttempts} attempts (Status ${response.status})`,
                    };
                }
                // Wait before retrying non-429 errors
                const retryWait = RETRY_DELAY_BASE_MS * attempt;
                console.log(`   ⏳ Waiting ${retryWait / 1000}s before retry...`);
                await new Promise((resolve) => setTimeout(resolve, retryWait));
                // Continue to the next attempt in the while loop
            }
        } catch (error) {
            console.error(`   ❌ Network or fetch error deleting message ${messageId}:`, error);
            if (error.message.includes('Unauthorized (401)')) throw error; // Propagate critical auth error

            if (attempt >= maxAttempts) {
                return {
                    success: false,
                    skipped: false,
                    error: `Failed after ${maxAttempts} attempts (Fetch Error: ${error.message})`,
                };
            }
            const retryWait = RETRY_DELAY_BASE_MS * attempt;
            console.log(`   ⏳ Waiting ${retryWait / 1000}s before retry due to fetch error...`);
            await new Promise((resolve) => setTimeout(resolve, retryWait));
            // Continue to the next attempt
        }
    }
    // Should only reach here if all attempts failed for non-429 reasons
    console.error(`   ❌ Failed to delete message ${messageId} after ${maxAttempts} attempts.`);
    return { success: false, skipped: false, error: `Failed after ${maxAttempts} attempts` };
}

// --- Main Execution ---
(async () => {
    const inputFilepath = path.resolve(__dirname, INPUT_FILE);
    let messagesToDelete = [];
    let deletedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    // 1. Read the JSON file
    try {
        console.log(`Reading messages from ${inputFilepath}...`);
        const fileContent = await fs.readFile(inputFilepath, 'utf-8');
        messagesToDelete = JSON.parse(fileContent);
        console.log(`Found ${messagesToDelete.length} messages to potentially delete.`);
        if (!Array.isArray(messagesToDelete)) {
            throw new Error('Input file does not contain a JSON array.');
        }
        if (messagesToDelete.length === 0) {
            console.log('No messages found in the file. Exiting.');
            return;
        }
        // Validate first message structure (basic check)
        if (!messagesToDelete[0]?.id || !messagesToDelete[0]?.channel_id) {
            throw new Error("Messages in the JSON file do not seem to have 'id' and 'channel_id' properties.");
        }
    } catch (error) {
        console.error(`Error reading or parsing ${INPUT_FILE}:`, error.message);
        process.exit(1);
    }

    console.log('\n--- Starting Deletion Process ---');
    console.log(`!!! ENSURE YOU WANT TO DELETE THESE ${messagesToDelete.length} MESSAGES !!!`);
    console.log(`Deletion will start in 5 seconds... Press Ctrl+C to abort.`);
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Final confirmation delay

    // 2. Iterate and Delete
    for (let i = 0; i < messagesToDelete.length; i++) {
        const message = messagesToDelete[i];
        console.log(
            `\n[${i + 1}/${messagesToDelete.length}] Processing message ID: ${message.id} in channel ${
                message.channel_id
            }`,
        );

        if (!message.id || !message.channel_id) {
            console.warn(`   ⚠️ Skipping message at index ${i} due to missing 'id' or 'channel_id'.`);
            skippedCount++;
            continue;
        }

        try {
            const result = await deleteMessage(message.channel_id, message.id);

            if (result.success) {
                deletedCount++;
            } else if (result.skipped) {
                skippedCount++;
            } else {
                failedCount++;
                console.error(`   Failed to delete message ${message.id}. Error: ${result.error}`);
                // Optional: break here if you want to stop on first failure
                // console.log("Stopping script due to deletion failure.");
                // break;
            }

            // Add delay before the *next* message, unless the last operation was a rate-limit wait
            if (i < messagesToDelete.length - 1) {
                // Check if the last action within deleteMessage involved a long wait already (simplistic check)
                // A more robust way would involve deleteMessage returning if it waited.
                // For simplicity, we always add the base delay here.
                console.log(`   --- Waiting ${DELETE_DELAY_MS / 1000}s before next message ---`);
                await new Promise((resolve) => setTimeout(resolve, DELETE_DELAY_MS));
            }
        } catch (error) {
            // Catch critical errors thrown from deleteMessage (like 401)
            console.error(`\nCRITICAL ERROR encountered: ${error.message}. Stopping deletion process.`);
            failedCount++; // Count the current message as failed
            break; // Stop the loop
        }
    }

    // 3. Final Report
    console.log('\n--- Deletion Process Finished ---');
    console.log(`Total messages processed: ${messagesToDelete.length}`);
    console.log(`✅ Successfully deleted: ${deletedCount}`);
    console.log(`🤷 Skipped (e.g., not found): ${skippedCount}`);
    console.log(`❌ Failed: ${failedCount}`);

    if (failedCount > 0) {
        console.warn('Some messages could not be deleted. Check logs above for details.');
    }
})();
