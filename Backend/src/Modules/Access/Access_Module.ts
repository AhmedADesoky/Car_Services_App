import { Module } from '@nestjs/common';
import { Auth_Module } from '../Auth/Auth_Module';
import { Access_Controller } from './Access_Controller';

/** Roles, permissions and account controls (screens 21, S12; sign-out of another person). */
@Module({
  imports: [Auth_Module],
  controllers: [Access_Controller],
})
export class Access_Module {}
