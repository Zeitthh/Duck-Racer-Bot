import { adopt } from './adopt';
import { balance } from './balance';
import { daily } from './daily';
import { coins } from './coins';
import { cosmetics } from './cosmetics';
import { duck } from './duck';
import { event } from './event';
import { pay } from './pay';
import { ping } from './ping';
import { race } from './race';
import { release } from './release';
import { rename } from './rename';
import { shop } from './shop';
import { train } from './train';
import type { Command } from './types';

export const commands: Command[] = [
  ping,
  adopt,
  duck,
  rename,
  release,
  train,
  daily,
  balance,
  pay,
  shop,
  race,
  event,
  cosmetics,
  coins,
];

/** Por nombre base (inglés): es el que llega en `interaction.commandName`, sea cual sea el idioma del usuario. */
export const commandsByName = new Map(commands.map((c) => [c.data.name, c]));
