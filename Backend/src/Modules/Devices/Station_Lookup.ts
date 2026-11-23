import { HttpStatus, Injectable } from '@nestjs/common';
import { Db_Client } from '../../Common/Database/Db_Client';
import { Api_Error } from '../../Common/Errors/Problem_Json_Filter';

export interface Station {
  id: string;
  station_code: string;
  display_name: string;
  default_locale: string;
  status: string;
}

/** Resolves a station code to its tenant. Unknown or blocked stations look the same: 404. */
@Injectable()
export class Station_Lookup {
  constructor(private readonly db: Db_Client) {}

  async findActive(stationCode: string): Promise<Station> {
    const rows = await this.db.platformQuery<Station>(
      `SELECT id, station_code, display_name, default_locale, status
         FROM app.tenants WHERE station_code = $1`,
      [stationCode.trim()],
    );
    const station = rows[0];
    if (!station) throw new Api_Error(HttpStatus.NOT_FOUND, 'STATION_NOT_FOUND', 'Station code not found');
    if (station.status === 'suspended') {
      throw new Api_Error(HttpStatus.FORBIDDEN, 'STATION_SUSPENDED', 'This station is suspended');
    }
    if (station.status !== 'active' && station.status !== 'trial') {
      throw new Api_Error(HttpStatus.NOT_FOUND, 'STATION_NOT_FOUND', 'Station code not found');
    }
    return station;
  }
}
