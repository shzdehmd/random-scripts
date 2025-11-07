// printer-forwarder-raw.js
const net = require('net');
const fs = require('fs');

// --- Configuration ---
const HOST = 'localhost';
const PORT = 9300;

// IMPORTANT: This is NOT the printer name. It is the UNC path to the
// SHARE NAME you just created in Step 1.
// Use '\\\\localhost\\YourShareName' if the script runs on the same PC as the printer.
// The double backslashes are required in a JavaScript string.
const PRINTER_SHARE_PATH = '\\\\localhost\\SpeedX-Generic'; // <-- CHANGE 'SpeedX' TO YOUR SHARE NAME

// --- Create the Server ---
const server = net.createServer((socket) => {
  console.log(`[SERVER] Client connected from ${socket.remoteAddress}:${socket.remotePort}. Forwarding raw data.`);

  // Create a writable stream directly to the printer's network share.
  // This is a raw pipe; no data will be processed or altered.
  const printerStream = fs.createWriteStream(PRINTER_SHARE_PATH);

  // --- Event Handlers ---
  printerStream.on('error', (err) => {
    console.error('[PRINTER] ERROR: Could not write to the printer share. Check the path and permissions.');
    console.error(`  - Path used: "${PRINTER_SHARE_PATH}"`);
    console.error(`  - Is the printer shared correctly with this exact name?`);
    console.error(`  - Original error: ${err.message}`);
    socket.end(); // Close the client connection on error
  });

  printerStream.on('open', () => {
    console.log('[PRINTER] Connection opened to printer share. Ready for data.');
  });
  
  printerStream.on('finish', () => {
      console.log('[PRINTER] All data has been written to the printer.');
  });

  // The magic happens here: Pipe all incoming network data directly to the printer.
  socket.pipe(printerStream);

  socket.on('data', (data) => {
    console.log(`[SERVER] Received and forwarded ${data.length} bytes of raw data.`);
  });

  socket.on('end', () => {
    console.log('[SERVER] Client disconnected.');
  });

  socket.on('error', (err) => {
    console.error('[SERVER] Socket error:', err);
  });
});

// --- Start Listening ---
server.listen(PORT, HOST, () => {
  console.log(`Raw Print Server listening on ${HOST}:${PORT}`);
  console.log(`Forwarding to printer share: ${PRINTER_SHARE_PATH}`);
  console.log('-------------------------------------------');
});

server.on('error', (err) => {
  console.error('[SERVER] Server error:', err);
});
