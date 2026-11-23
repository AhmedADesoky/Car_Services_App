import { Module } from '@nestjs/common';
import { Health_Controller } from './Health_Controller';

@Module({ controllers: [Health_Controller] })
export class Health_Module {}
