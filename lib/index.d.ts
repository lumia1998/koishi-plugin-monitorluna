import { Context, Schema } from 'koishi';
export declare const name = "screenluna";
export interface Config {
    devices: Device[];
}
export interface Device {
    name: string;
    ip: string;
    port: number;
}
export declare const Config: Schema<Config>;
export declare function apply(ctx: Context, config: Config): void;
