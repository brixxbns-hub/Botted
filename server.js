import express from 'express';

const server = express();

server.all('/', (req, res) => {
  res.send('<h2>Server is ready!</h2>');
});

export default function startServer() {
  server.listen(4000, () => {
    console.log('Server Ready.');
  });
  return true;
}
