/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { EventEmitter } from "events";

import { PlayerInfoMessage } from "../../../../modules/messages/client-to-server/PlayerInfoMessage";
import { Commands } from "../../../../modules/messages/domain/Commands";
import { ClientMessage } from "../../../../modules/messages/MessageProcessor";
import { RoomState } from "../../../../modules/room/domain/RoomState";
import { Logger } from "../../../../modules/shared/logger/domain/Logger";
import { PlayerEnterClientMessage } from "../../../../modules/shared/messages/server-to-client/PlayerEnterClientMessage";
import { TypeChangeClientMessage } from "../../../../modules/shared/messages/server-to-client/TypeChangeClientMessage";
import { ISocket } from "../../../../modules/shared/socket/domain/ISocket";
import { MercuryClient } from "../../../client/domain/MercuryClient";
import { MercuryRoom } from "../MercuryRoom";

export class MercuryDuelingState extends RoomState {
	constructor(eventEmitter: EventEmitter, private readonly logger: Logger) {
		super(eventEmitter);
		this.eventEmitter.on(
			"DUEL_END",
			(message: ClientMessage, room: MercuryRoom, client: MercuryClient) =>
				this.handle.bind(this)(message, room, client)
		);

		this.eventEmitter.on(
			"JOIN",
			(message: ClientMessage, room: MercuryRoom, socket: ISocket) =>
				void this.handleJoin.bind(this)(message, room, socket)
		);

		this.eventEmitter.on(
			Commands.UPDATE_DECK as unknown as string,
			(message: ClientMessage, room: MercuryRoom, socket: ISocket) =>
				void this.handleUpdateDeck.bind(this)(message, room, socket)
		);
	}

	private handle(_message: ClientMessage, _room: MercuryRoom, _player: MercuryClient): void {
		this.logger.info("MERCURY: DUEL_END");
	}

	private handleJoin(message: ClientMessage, room: MercuryRoom, socket: ISocket): void {
		this.logger.info("MERCURY: JOIN");
		const playerInfoMessage = new PlayerInfoMessage(message.previousMessage, message.data.length);
		const playerAlreadyInRoom = this.playerAlreadyInRoom(playerInfoMessage, room, socket);

		if (!(playerAlreadyInRoom instanceof MercuryClient)) {
			const spectator = new MercuryClient({
				socket,
				logger: this.logger,
				messages: [],
				name: playerInfoMessage.name,
				position: room.playersCount,
				room,
				host: false,
			});
			room.addSpectator(spectator, true);

			return;
		}

		playerAlreadyInRoom.setSocket(socket);
		if (room.joinBuffer) {
			playerAlreadyInRoom.socket.send(room.joinBuffer);
			const type = playerAlreadyInRoom.host
				? playerAlreadyInRoom.position + 0x10
				: playerAlreadyInRoom.position;
			playerAlreadyInRoom.socket.send(TypeChangeClientMessage.create({ type }));

			room.clients.forEach((player) => {
				playerAlreadyInRoom.socket.send(
					PlayerEnterClientMessage.create(player.name, player.position)
				);
			});
		}
	}

	private handleUpdateDeck(
		_message: ClientMessage,
		_room: MercuryRoom,
		player: MercuryClient
	): void {
		this.logger.info("MERCURY: UPDATE_DECK");
		player.sendToCore(Buffer.from([0x01, 0x00, 0x30]));
	}
}
