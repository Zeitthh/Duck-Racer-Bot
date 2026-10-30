import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import type { Ctx } from '../context';

export interface Command {
  data: { name: string; toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody };
  execute(interaction: ChatInputCommandInteraction<'cached'>, ctx: Ctx): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction<'cached'>, ctx: Ctx): Promise<void>;
}
