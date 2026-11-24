import { Module } from '@nestjs/common';
import { Common_Module } from './Common/Common_Module';
import { Access_Module } from './Modules/Access/Access_Module';
import { Auth_Module } from './Modules/Auth/Auth_Module';
import { Devices_Module } from './Modules/Devices/Devices_Module';
import { Health_Module } from './Modules/Health/Health_Module';
import { Assistant_Controller } from './Modules/Public/Assistant_Controller';
import { Public_Controller } from './Modules/Public/Public_Controller';

/**
 * Modular monolith (spec section 4.2). New modules (Workers, Branches, Attendance, Orders...)
 * are added under src/Modules/<Name>/ with <Name>_Module.ts, <Name>_Controller.ts, <Name>_Service.ts.
 */
@Module({
  imports: [Common_Module, Health_Module, Devices_Module, Auth_Module, Access_Module],
  controllers: [Public_Controller, Assistant_Controller],
})
export class App_Module {}
