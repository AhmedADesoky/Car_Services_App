import { Module } from '@nestjs/common';
import { Devices_Module } from '../Devices/Devices_Module';
import { Auth_Controller } from './Auth_Controller';
import { Auth_Service } from './Auth_Service';

@Module({
  imports: [Devices_Module],
  controllers: [Auth_Controller],
  providers: [Auth_Service],
})
export class Auth_Module {}
