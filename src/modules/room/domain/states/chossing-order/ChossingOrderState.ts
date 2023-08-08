/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import EventEmitter from "events";

import { YGOClientSocket } from "../../../../../socket-server/HostServer";
import { Client } from "../../../../client/domain/Client";
import { JoinGameMessage } from "../../../../messages/client-to-server/JoinGameMessage";
import { PlayerInfoMessage } from "../../../../messages/client-to-server/PlayerInfoMessage";
import { Commands } from "../../../../messages/domain/Commands";
import { ClientMessage } from "../../../../messages/MessageProcessor";
import { ChooseOrderClientMessage } from "../../../../messages/server-to-client/ChooseOrderClientMessage";
import { DuelStartClientMessage } from "../../../../messages/server-to-client/DuelStartClientMessage";
import { Logger } from "../../../../shared/logger/domain/Logger";
import { JoinToDuelAsSpectator } from "../../../application/JoinToDuelAsSpectator";
import { Reconnect } from "../../../application/Reconnect";
import { Room } from "../../Room";
import { RoomState } from "../../RoomState";

export class ChossingOrderState extends RoomState {
	constructor(
		eventEmitter: EventEmitter,
		private readonly logger: Logger,
		private readonly reconnect: Reconnect,
		private readonly joinToDuelAsSpectator: JoinToDuelAsSpectator
	) {
		super(eventEmitter);

		this.eventEmitter.on(
			"JOIN" as unknown as string,
			(message: ClientMessage, room: Room, socket: YGOClientSocket) =>
				this.handleJoin.bind(this)(message, room, socket)
		);

		this.eventEmitter.on(
			Commands.READY as unknown as string,
			(message: ClientMessage, room: Room, client: Client) =>
				this.handleReady.bind(this)(message, room, client)
		);

		this.eventEmitter.on(
			Commands.TURN_CHOICE as unknown as string,
			(message: ClientMessage, room: Room, client: Client) =>
				this.handle.bind(this)(message, room, client)
		);
	}

	private handle(message: ClientMessage, room: Room, player: Client): void {
		const turn = message.data.readInt8();
		const team = room.clients.find((client) => client === player)?.team;

		if ((team === 0 && turn === 0) || (team === 1 && turn === 1)) {
			room.setFirstToPlay(1);
			room.dueling();

			return;
		}

		room.setFirstToPlay(0);
		room.dueling();
	}

	private handleReady(message: ClientMessage, room: Room, player: Client): void {
		this.logger.info("CHOSSING ORDER: READY");

		if (!player.isReconnecting) {
			return;
		}

		player.sendMessage(DuelStartClientMessage.create());

		if (room.clientWhoChoosesTurn.position === player.position) {
			const message = ChooseOrderClientMessage.create();
			room.clientWhoChoosesTurn.sendMessage(message);
		}

		player.clearReconnecting();
	}

	private async handleJoin(
		message: ClientMessage,
		room: Room,
		socket: YGOClientSocket
	): Promise<void> {
		this.logger.info("JOIN IN RPS");
		const playerInfoMessage = new PlayerInfoMessage(message.previousMessage, message.data.length);
		const joinMessage = new JoinGameMessage(message.data);
		const reconnectingPlayer = this.playerAlreadyInRoom(playerInfoMessage, room, socket);

		if (!reconnectingPlayer) {
			this.joinToDuelAsSpectator.run(joinMessage, playerInfoMessage, socket, room);

			return;
		}

		await this.reconnect.run(playerInfoMessage, reconnectingPlayer, joinMessage, socket, room);
	}
}
