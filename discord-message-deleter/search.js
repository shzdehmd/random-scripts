// Import necessary modules
require('dotenv').config(); // Load .env variables first
const { fetch } = require('undici');
const fs = require('fs/promises');

// --- Configuration ---
const AUTHOR_ID = process.env.AUTHOR_ID;
const GUILD_ID = process.env.GUILD_ID;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const OUTPUT_FILE = 'found_messages.json';
const BASE_URL = 'https://discord.com/api/v9';
// const PAGE_SIZE = 25; // We don't strictly need this for the loop logic anymore, but it's useful context
const REQUEST_DELAY_MS = 1100; // Delay between requests (ms) to avoid rate limits

// --- Validate Configuration ---
if (!AUTHOR_ID || !GUILD_ID || !DISCORD_TOKEN) {
    console.error(
        'Error: Missing environment variables. Ensure AUTHOR_ID, GUILD_ID, and DISCORD_TOKEN are set in your .env file.',
    );
    process.exit(1); // Exit if config is missing
}

// --- Warning about User Tokens ---
if (!DISCORD_TOKEN.startsWith('Bot ')) {
    console.warn(
        '\n******************** WARNING ********************\n' +
            'The provided DISCORD_TOKEN does not appear to be a Bot token.\n' +
            "Automating user accounts (self-botting) is against Discord's Terms of Service and can lead to account termination.\n" +
            'Proceed with caution and at your own risk.\n' +
            'It is strongly recommended to use a proper Discord Bot token for automation.\n' +
            '***********************************************\n',
    );
}

// --- Fetch Headers ---
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
    Referer: 'https://discord.com/channels/756426702066024449/1360000426962849894',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
};

/**
 * Fetches messages recursively from the Discord search API.
 * Relies on total_results and accumulated count for pagination.
 * @param {number} offset - The starting offset for the search page.
 * @param {Array} accumulatedMessages - Array accumulating the messages.
 * @param {number | null} knownTotalResults - The total results expected, fetched from the first successful call.
 * @returns {Promise<Array>} - A promise that resolves with the array of all messages.
 */
async function fetchMessagesRecursive(offset = 0, accumulatedMessages = [], knownTotalResults = null) {
    const url = new URL(`${BASE_URL}/guilds/${GUILD_ID}/messages/search`);
    url.searchParams.set('author_id', AUTHOR_ID);
    // Only add offset if it's greater than 0
    if (offset > 0) {
        url.searchParams.set('offset', offset);
    }
    // Setting limit explicitly might help consistency, though API defaults usually to 25
    // url.searchParams.set('limit', 25);

    console.log(`Fetching messages with offset: ${offset}... (Target total: ${knownTotalResults ?? 'Unknown'})`);

    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: headers,
        });

        // Handle Rate Limits (429)
        if (response.status === 429) {
            const retryAfterHeader = response.headers.get('retry-after');
            // Discord API sometimes returns retry_after in seconds (float or int) in the JSON body too
            let waitMs = 5000; // Default wait
            if (retryAfterHeader) {
                waitMs = parseInt(retryAfterHeader, 10) * 1000;
            } else {
                try {
                    // Attempt to read body for JSON retry_after (common in Discord 429s)
                    const rateLimitBody = await response.json();
                    if (rateLimitBody.retry_after) {
                        waitMs = Math.ceil(rateLimitBody.retry_after * 1000);
                    }
                    console.warn(`Rate limit details from body: ${JSON.stringify(rateLimitBody)}`);
                } catch (e) {
                    // Ignore if body isn't JSON or doesn't have retry_after
                    console.warn('Could not parse rate limit body or find retry_after in it.');
                }
            }

            // Ensure minimum wait to avoid immediate re-limit
            waitMs = Math.max(waitMs, REQUEST_DELAY_MS + 100);

            console.warn(`Rate limited. Waiting ${waitMs / 1000} seconds...`);
            await new Promise((resolve) => setTimeout(resolve, waitMs));
            // Retry the same offset and pass the known total if we have it
            return fetchMessagesRecursive(offset, accumulatedMessages, knownTotalResults);
        }

        // Handle other errors
        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Error fetching messages: ${response.status} ${response.statusText}`);
            console.error(`URL: ${url.toString()}`);
            console.error(`Response body: ${errorBody}`);
            throw new Error(`Failed to fetch messages (status: ${response.status}). Stopping.`);
        }

        const data = await response.json();

        // Extract messages and total results
        const newMessages = data.messages ? data.messages.flat() : [];
        const currentTotalResults = data.total_results;

        // If this is the first successful fetch, store the total results reported by the API.
        const effectiveTotalResults = knownTotalResults === null ? currentTotalResults : knownTotalResults;

        if (newMessages.length > 0) {
            accumulatedMessages.push(...newMessages);
            console.log(
                `Fetched ${newMessages.length} messages. Total accumulated: ${accumulatedMessages.length} / ${effectiveTotalResults}`,
            );
        } else {
            console.log(`No messages found on this page (offset ${offset}).`);
            // If we received 0 messages, but think there should be more, log a warning.
            if (accumulatedMessages.length < effectiveTotalResults) {
                console.warn(
                    `Warning: Received 0 messages, but expected total is ${effectiveTotalResults}. Accumulated: ${accumulatedMessages.length}. There might be an API issue or the total count was inaccurate.`,
                );
            }
        }

        // --- **REVISED Pagination Logic** ---
        // Continue if we haven't reached the total reported count AND the last fetch returned *some* messages.
        // The second condition prevents potential infinite loops if total_results is inaccurate and the API keeps returning empty pages.
        const hasMore = accumulatedMessages.length < effectiveTotalResults && newMessages.length > 0;

        if (hasMore) {
            // Wait a bit before the next request
            await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));

            // **Calculate the next offset based on the current total accumulated messages.**
            const nextOffset = accumulatedMessages.length;

            // Recursively call for the next page, passing the *new* offset and the *known* total results
            return fetchMessagesRecursive(nextOffset, accumulatedMessages, effectiveTotalResults);
        } else {
            if (accumulatedMessages.length >= effectiveTotalResults) {
                console.log(`\nFinished fetching. Reached or exceeded expected total (${effectiveTotalResults}).`);
            } else {
                console.log('\nFinished fetching. Last page returned no new messages.');
            }
            return accumulatedMessages; // Base case: return accumulated messages
        }
    } catch (error) {
        console.error('An error occurred during the fetch process:', error);
        console.warn('Returning potentially incomplete message list due to error.');
        return accumulatedMessages; // Return what we have so far
    }
}

// --- Main Execution ---
(async () => {
    try {
        console.log(`Starting message fetch for author ${AUTHOR_ID} in guild ${GUILD_ID}...`);
        // Initial call starts with offset 0 and no known total results
        const allMessages = await fetchMessagesRecursive(0, [], null);

        console.log(`\nTotal messages fetched and processed: ${allMessages.length}`);

        if (allMessages.length > 0) {
            await fs.writeFile(OUTPUT_FILE, JSON.stringify(allMessages, null, 2)); // Pretty print JSON
            console.log(`Successfully saved ${allMessages.length} messages to ${OUTPUT_FILE}`);
        } else {
            console.log('No messages were ultimately found or saved for the specified author in this guild.');
        }
    } catch (error) {
        console.error('\nScript execution failed:', error.message);
        process.exit(1); // Exit with error code
    }
})();
