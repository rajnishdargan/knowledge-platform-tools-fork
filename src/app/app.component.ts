import { Component } from '@angular/core';
import { environment } from '../../src/environments/environment';
import { taxonomyConfig } from '../assets/config';
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  public environment = environment;
  public taxonomyConfig = taxonomyConfig;
  constructor() { }

  ngOnInit() {
    console.log("environment ===>", environment);
    console.log("taxonomyConfig ===>", taxonomyConfig);
  }
}
