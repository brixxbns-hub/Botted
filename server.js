import express from 'express';

const server = express();

server.all('/', (req, res) => {
  res.send('<h2>Server is ready!</h2>');
});

export default function startServer() {
  return new Promise((resolve, reject) => {
    const listener = server.listen(4000, () => {
      console.log('Server Ready.');
      resolve(true);
    });
    listener.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error('Another instance is already running on port 4000. Exiting to prevent duplicate bot responses.');
        process.exit(1);
      }
      reject(err);
    });
  });
}
