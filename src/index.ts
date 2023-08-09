import "reflect-metadata";
import "./modules/shared/error-handler/error-handler";

import { Server } from "./http-server/Server";
import { BanListLoader } from "./modules/ban-list/infrastructure/BanListLoader";
import { SQLiteTypeORM } from "./modules/shared/db/postgres/infrastructure/SQLiteTypeORM";
import { Pino } from "./modules/shared/logger/infrastructure/Pino";
import { HostServer } from "./socket-server/HostServer";

void start();

async function start(): Promise<void> {
	const logger = new Pino();
	const server = new Server(logger);
	const hostServer = new HostServer(logger);
	const database = new SQLiteTypeORM();
	const banListLoader = new BanListLoader();
	await banListLoader.loadDirectory("./banlists");
	await database.connect();
	await database.initialize();
	await server.initialize();
	hostServer.initialize();
}
