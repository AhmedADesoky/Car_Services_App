import { Module } from '@nestjs/common';
import { Devices_Controller } from './Devices_Controller';
import { Station_Lookup } from './Station_Lookup';

@Module({
  controllers: [Devices_Controller],
  providers: [Station_Lookup],
  exports: [Station_Lookup],
})
export class Devices_Module {}
