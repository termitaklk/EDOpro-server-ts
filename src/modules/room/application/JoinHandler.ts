import { EventEmitter } from "stream";

import { MercuryRoom } from "../../../mercury/room/domain/MercuryRoom";
import MercuryRoomList from "../../../mercury/room/infrastructure/MercuryRoomList";
import { JoinGameMessage } from "../../messages/client-to-server/JoinGameMessage";
import { Commands } from "../../messages/domain/Commands";
import { ClientMessage } from "../../messages/MessageProcessor";
import { ErrorMessages } from "../../messages/server-to-client/error-messages/ErrorMessages";
import { ErrorClientMessage } from "../../messages/server-to-client/ErrorClientMessage";
import { ServerErrorClientMessage } from "../../messages/server-to-client/ServerErrorMessageClientMessage";
import { Logger } from "../../shared/logger/domain/Logger";
import { JoinMessageHandler } from "../../shared/room/domain/JoinMessageHandler";
import { ISocket } from "../../shared/socket/domain/ISocket";
import { Room } from "../domain/Room";
import RoomList from "../infrastructure/RoomList";

export class JoinHandler implements JoinMessageHandler {
	private readonly eventEmitter: EventEmitter;
	private readonly logger: Logger;
	private readonly socket: ISocket;

	constructor(eventEmitter: EventEmitter, logger: Logger, socket: ISocket) {
		this.eventEmitter = eventEmitter;
		this.logger = logger;
		this.socket = socket;
		this.eventEmitter.on(Commands.JOIN_GAME as unknown as string, (message: ClientMessage) =>
			this.handle(message)
		);
	}

	handle(message: ClientMessage): void {
		this.logger.info("JoinHandler");
		const joinMessage = new JoinGameMessage(message.data);
		const room = this.findRoom(joinMessage);

		if (!room) {
			this.socket.send(
				ServerErrorClientMessage.create("Sala no encontrada. Intenta recargando la lista")
			);

			this.socket.send(ErrorClientMessage.create(ErrorMessages.JOINERROR));

			this.socket.destroy();

			return;
		}

		if (room.password !== joinMessage.password) {
			this.socket.send(ServerErrorClientMessage.create("Clave incorrecta"));
			this.socket.send(ErrorClientMessage.create(ErrorMessages.JOINERROR));
			this.socket.destroy();

			return;
		}

		room.emit("JOIN", message, this.socket);
	}

	private findRoom(joinMessage: JoinGameMessage): MercuryRoom | Room | null {
		const room = RoomList.getRooms().find((room) => room.id === joinMessage.id);
		if (room) {
			return room;
		}

		return MercuryRoomList.findById(joinMessage.id);
	}
}
