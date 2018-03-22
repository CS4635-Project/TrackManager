import React from 'react';
import { StyleSheet, Text, View, Button, StatusBar, Image, AsyncStorage } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import ActionButton from 'react-native-action-button';
import Icon from 'react-native-vector-icons/Ionicons';
var dgram = require('react-native-udp');
var RNFS = require('react-native-fs');
import Spinner from 'react-native-loading-spinner-overlay';




class LatLng {
  constructor(lat, long) {
    this.latitude = lat;
    this.longitude = long;
  }
}

class Light {
  constructor(latLng, ip, lastStatus) {
    this.latlng = latLng;
    this.ip = ip;
    this.lastStatus = lastStatus;
    this._socket = dgram.createSocket('udp4');
    this._socket.bind(4210);
    this._socket.on('message', (msg, rinfo) => console.log(`Received ${msg} from ${rinfo}`));
  }

  _sendMessage(mess) {
    console.log(`Sending ${mess} to ${this.ip}`);
    this._socket.send(mess, 0, mess.length, 4210, this.ip, (err) => console.log(err));
  }

  toggleState() {
    this._sendMessage(this.lastStatus=='1' ? '0' : '1');
  }

  turnOn() {
    this._sendMessage('0');
  }

  turnOff() {
    this._sendMessage('1');
  }

}

function getFileNameFromTrackName(trackName) {
  return `${RNFS.DocumentDirectoryPath}/${trackName}.track`
}

class Track {
  constructor(name, centerLatLng, lights) {
    this.name = name;
    this.centerLatLng = centerLatLng;
    this.lights = lights;
    if (this.lights === [] || this.lights == null || this.centerLatLng == null) {
      console.log("Error initting Track!");
      /*var a = '192.168.0.112';
      this.lights = [ // TODO push user to new track or pull track screen
        new Light(new LatLng(38.92083775666782, -82.08739463754273), a, false),
        new Light(new LatLng(38.92292621458797, -82.08649341531373), a, false),
      ];
      this.centerLatLng = mason;
      this.name = 'Mason County Fair';*/

    }
  }

  get region() {
    return {
      latitude: this.centerLatLng.latitude,
      longitude: this.centerLatLng.longitude,
      latitudeDelta: this._latDelta ? this._latDelta : 0.0025,
      longitudeDelta: this._longDelta ? this._longDelta : 0.0025,
    }
  }

  set region(value) {
    this._latDelta = value.latitudeDelta;
    this._longDelta = value.longitudeDelta;
  }

  static fromJson(dict) {
    /* This is a hack that should probably be replaced by some kind of library. */
    console.log(`${dict.lights}`)
    var lights = dict.lights.map((x) => new Light(new LatLng(x.latlng.latitude, x.latlng.longitude), x.ip, x.lastStatus));
    console.log(lights);
    return new Track(dict.name, dict.centerLatLng, lights);
  }

  jsonCensor(key, value) {
    if (key == "_socket") return undefined;
    return value;
  }
}

const mason = {latitude: 38.92188114803696, longitude: -82.08681528039551};

export default class MyApp extends React.Component {
  MODES = Object.freeze({ride: 0, control: 1, edit: 2});

  constructor(props) {
    super(props);
    
    RNFS.readFile(getFileNameFromTrackName('Mason County Fair'), 'utf8')
      .then((res) => {
        console.log(`Loaded data: ${res}`);
        this.setState({
          track: Track.fromJson(JSON.parse(res))
        });
      });

    //var t = new Track();
    this.state = {
      counter: 392,
      track: null,
      currentMode: 2,
    };


    this.modes = [{ 
      title: 'Ride',
      icon: 'md-bicycle',
      buttonColor: 'red',
      onSelect: () => console.log("hi"),
      index: 0
    },
    { 
      title: 'Control',
      icon: 'md-flag',
      buttonColor: 'red',
      onSelect: () => {x: console.log("hi")},
      index: 1,
      markerClicked: (e, light) => {
        let track = {...this.state.track};
        light.toggleState()
        this.setState({
          track: track
        });
      }
    },
    { 
      title: 'Edit',
      icon: 'md-create',
      buttonColor: 'red',
      onSelect: () => console.log("hi"),
      index: 2,
      markerDraggingEnabled: true,
      markerDragEnd: (e, light) => {
        console.log(`Light ${light.ip} moved to ${e.nativeEvent.coordinate.latitude}`);
        light.latlng = e.nativeEvent.coordinate;
      },
      markerClicked: (e) => {
        console.log(e.nativeEvent.coordinate);
      }
    }
    ];
  } 

  selectMode(newMode) {
    this.setState({currentMode: newMode.index});
    // We only persist upon switching modes for simplicity
    /*console.log(store.save(this.state.track.name, {x: JSON.stringify(this.state.track, this.state.track.jsonCensor)})
      .then((v) => console.log("Persisted track!"))
      .catch((e) => console.log(`Error saving track! ${e}`)));
    store.keys().then((res) => console.log(res));*/
    var storeThis = JSON.stringify(this.state.track, this.state.track.jsonCensor);
    /*AsyncStorage.setItem(this.state.track.name,
      
      .then(() => console.log("Done!"));*/
    var path = getFileNameFromTrackName(this.state.track.name);
    RNFS.writeFile(path, storeThis, 'utf8')
      .then(() => console.log(`Successfully persisted ${this.state.track.name}!`))
      .catch((err) => console.log(err.message));
    if (newMode.onSelect) {
      newMode.onSelect();
    }
  }



  render() {
    printStuff = function(ci) {
      console.log(ci.nativeEvent.coordinate);
    }

    console.log();
    var mode = this.modes[this.state.currentMode];
    if (this.state.track == null) { // Not done loading!
      return (
      <View style={{flex: 1}}>
        <Spinner textContent={"Loading..."} />
      </View>
      )
    }

    return (
      <View style ={styles.container}>
        <StatusBar hidden />
        <MapView
          style={styles.map}
          region={this.state.track.region}
          mapType="satellite"
          showsPointsOfInterest={false}
          showBuildings={false}
          //scrollEnabled={false}
          moveOnMarkerPress={false}
        >
        <Marker coordinate={mason}
        onPress={printStuff}
        />
        {this.state.track.lights.map(light => (
          <Marker key={light.latlng.longitude} coordinate={light.latlng} title="hi"
          onPress={mode.markerClicked ? (e) => mode.markerClicked(e, light) : null}
          draggable={mode.markerDraggingEnabled}
          onDragEnd={mode.markerDraggingEnabled ? (e) => mode.markerDragEnd(e, light) : null}
          flat={true}
          anchor={{x: 0.5, y: 0.5}}
          >
          <Image source={light.lastStatus ? require('./assets/light_on.png') : require('./assets/light_off.png')} style={{width: 35, height: 35}}/>
          </Marker>
        ))}
        </MapView>


        {/* Floating mode switcher TODO replace with loop through modes*/}
        {this.modes.map((x) => console.log(x))}
        <ActionButton buttonColor="rgba(231,76,60,0.8)">
          {this.modes.map((mode) => (
            <ActionButton.Item  key={mode.title}
              buttonColor={mode.buttonColor} title={mode.title} onPress={() => this.selectMode(mode)}>
              <Icon name={mode.icon} style={styles.actionButtonIcon} />
            </ActionButton.Item>
          ))}
        </ActionButton>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    //height: 400,
    //width: 400,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    justifyContent: "space-between",
    flexDirection: 'row'
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
});