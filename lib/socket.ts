import { Server as SocketIOServer } from 'socket.io';

let io: SocketIOServer | null = null;

export function setSocketIO(ioInstance: SocketIOServer) {
  io = ioInstance;
}

export function getSocketIO(): SocketIOServer | null {
  return io;
}
