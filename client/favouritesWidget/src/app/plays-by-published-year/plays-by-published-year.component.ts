import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import {CollectionWithPlays, makeGamesIndex, roundRating, GamePlays} from "extstats-core";
import {DataViewComponent} from "extstats-angular";
import * as THREE from "three";
import * as TrackballControls from 'three-trackballcontrols';

@Component({
  selector: 'plays-by-published-year',
  templateUrl: './plays-by-published-year.component.html',
  styleUrls: ['./plays-by-published-year.component.css']
})
export class PlaysByPublishedYearComponent extends DataViewComponent<CollectionWithPlays> implements AfterViewInit {
  @ViewChild('container') container: ElementRef;
  private static readonly SIZE = 5;
  private readonly ALDIES_COLOURS = [
    0xff0000,
    0xff3366,
    0xff6699,
    0xff66cc,
    0xcc99ff,
    0x9999ff,
    0x99ffff,
    0x66ff99,
    0x33cc99,
    0x00cc00];

  private camera;
  private controls;
  private scene;
  private renderer;
  private objects;

  protected processData(data: CollectionWithPlays) {
    this.build(data);
    this.animate();
  }

  private addObjects(data: CollectionWithPlays, geometry: THREE.BoxBufferGeometry) {
    const gamesIndex = makeGamesIndex(data.games);
    const playsIndex = PlaysByPublishedYearComponent.makePlaysIndex(data.plays);
    const byYear: { [year: number]: { rating: number, plays: number, name: string }[] } = {};
    data.collection.forEach(gg => {
      if (gg.rating > 0) {
        const rating = roundRating(gg.rating);
        const g = gamesIndex[gg.bggid];
        const year = g.yearPublished;
        if (year >= 1990) {
          if (!byYear[year]) byYear[year] = [];
          const plays = playsIndex[gg.bggid].plays || 0;
          byYear[year].push({ rating, plays, name: g.name });
        }
      }
    });
    Object.keys(byYear).forEach(year => {
      const forYear = byYear[year];
      forYear.sort((g1, g2) => g1.plays - g2.plays);
      let index = 0;
      forYear.forEach(entry => {
        const x = (+year - 1990) * PlaysByPublishedYearComponent.SIZE;
        const y = index * PlaysByPublishedYearComponent.SIZE;
        const height = entry.plays;
        const object = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial( { color: this.ALDIES_COLOURS[entry.rating-1] } ));
        object.position.x = x;
        object.position.y = y;
        object.position.z = 0;
        object.rotation.x = 0;
        object.rotation.y = 0;
        object.rotation.z = 0;
        object.scale.x = PlaysByPublishedYearComponent.SIZE;
        object.scale.y = PlaysByPublishedYearComponent.SIZE;
        object.scale.z = height * PlaysByPublishedYearComponent.SIZE;
        object.castShadow = true;
        object.receiveShadow = true;
        this.scene.add(object);
        this.objects.push(object);

        index++;
      });
    });
  }

  private static makePlaysIndex(plays: GamePlays[]): { [bggid: number]: GamePlays } {
    const result = {};
    plays.forEach(gp => {
      result[gp.game] = gp;
    });
    return result;
  }

  private build(data: CollectionWithPlays) {
    this.camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 1, 5000 );
    this.camera.position.z = 1000;
    this.controls = new TrackballControls(this.camera);
    this.controls.rotateSpeed = 1.0;
    this.controls.zoomSpeed = 1.2;
    this.controls.panSpeed = 0.8;
    this.controls.noZoom = false;
    this.controls.noPan = false;
    this.controls.staticMoving = true;
    this.controls.dynamicDampingFactor = 0.3;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf0f0f0);
    this.scene.add(new THREE.AmbientLight(0x505050));
    const light = new THREE.SpotLight( 0xffffff, 1.5 );
    light.position.set( 0, 500, 2000 );
    light.angle = Math.PI / 9;
    light.castShadow = true;
    light.shadow.camera.near = 1000;
    light.shadow.camera.far = 4000;
    light.shadow.mapSize.width = 1024;
    light.shadow.mapSize.height = 1024;

    this.scene.add(light);

    const geometry = new THREE.BoxBufferGeometry( 40, 40, 40 );
    this.objects = [];
    this.addObjects(data, geometry);

    this.renderer = new THREE.WebGLRenderer( { antialias: true } );
    this.renderer.setPixelRatio( window.devicePixelRatio );
    this.renderer.setSize( window.innerWidth, window.innerHeight );

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.container.nativeElement.appendChild( this.renderer.domElement );
  }

  public startDrag(event) {
    this.controls.enabled = false;
  }

  public endDrag(event) {
    this.controls.enabled = true;
  }

  private onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize( window.innerWidth, window.innerHeight );
  }

  private animate() {
    requestAnimationFrame(() => this.animate());
    this.render();
  }

  private render() {
    this.controls.update();
    this.renderer.render( this.scene, this.camera );
  }
}
