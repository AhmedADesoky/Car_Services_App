import { Module } from '@nestjs/common';
import { Common_Module } from './Common/Common_Module';
import { Auth_Module } from './Modules/Auth/Auth_Module';
import { Devices_Module } from './Modules/Devices/Devices_Module';
import { Health_Module } from './Modules/Health/Health_Module';

/**
 * Modular monolith (spec section 4.2). New modules (Workers, Branches, Attendance, Orders...)
 * are added under src/Modules/<Name>/ with <Name>_Module.ts, <Name>_Controller.ts, <Name>_Service.ts.
 */
@Module({
  imports: [Common_Module, Health_Module, Devices_Module, Auth_Module],
})
export class App_Module {}
