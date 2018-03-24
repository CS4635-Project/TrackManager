import React from 'react';
import { ActivityIndicator, TextInput, ScrollView, StyleSheet, View, StatusBar, Image, AsyncStorage, FlatList } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import Icon from 'react-native-vector-icons/Ionicons';
var dgram = require('react-native-udp');
var RNFS = require('react-native-fs');
import Spinner from 'react-native-loading-spinner-overlay';
import PopupDialog from 'react-native-popup-dialog';
import ActionButton from 'react-native-action-button';
import { Icon as BaseIcon, Container, Fab, Form, Item, Label, Input, List, ListItem, Header, Title, Content, Footer, FooterTab, Left, Right, Body, Text, Button  } from 'native-base';
import { PermissionsAndroid } from 'react-native';
import DialogManager, { ScaleAnimation, DialogContent } from 'react-native-dialog-component';
import Modal from "react-native-modal";


const controllerIP = '192.168.0.105';

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
    /* Every light is listening on a socket. This is possibly not good, but fuck it. */
    this._socket = dgram.createSocket('udp4');
    //this._socket.bind(4210);
    //this._socket.on('message', (msg, rinfo) => console.log(`Received ${msg} from ${rinfo}`));
  }

  _sendMessage(mess) {
    console.log(`Sending ${mess} to ${this.ip}`);
    //this._socket.send([1, 1, 1, 1, 1], 0, 4, 4210, this.ip, (err) => console.log('hi'));
    v//ar b = new Buffer(mess);
    this._socket.send(mess, 0, 100, 4210, this.ip, (err) => console.log(err));
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


class Track {
  constructor(name, region, lights) {
    this.name = name;
    this.region = region;
    if (this.region == undefined || this.region.latitudeDelta == undefined) {
      console.log(`Error initting ${name}`);
    }
    this.lights = lights;
    if (this.lights == null) {
      this.lights = [];
      console.log("Error initting Track!");
    }
  }

  saveTrack(callback=false) {
    var storeThis = JSON.stringify(this, Track.jsonCensor);
    /*AsyncStorage.setItem(this.state.track.name, Doesn't work
      .then(() => console.log("Done!"));*/
    var path = Track.getFileNameFromTrackName(this.name);
    if (callback) {
      return RNFS.writeFile(path, storeThis, 'utf8');
    }
    // Otherwise, handle it ourselves.
    RNFS.writeFile(path, storeThis, 'utf8')
      .then(() => console.log(`Successfully persisted ${this.name}!`))
      .catch((err) => console.log(err.message));
  }

  static getFileNameFromTrackName(name) {
    return `${Track.getTrackFolder()}/${name}`;
  }

  static getTrackFolder() {
    const path = `${RNFS.DocumentDirectoryPath}/tracks`;
    RNFS.mkdir(path);
    return path;
  }

  static fromTrackName(trackName, callback) {
    const opening = Track.getFileNameFromTrackName(trackName);
    console.log(`Track ${trackName} -> Opening file ${opening}`);
    RNFS.readFile(opening, 'utf8')
    .then((res) => {
      console.log(`Loaded track data: ${res}`);
      var t = Track.fromJson(JSON.parse(res));
      console.log(`Parsed to ${track.lights}`);
      /*this.setState({
        track: Track.fromJson(JSON.parse(res))
      });*/
      callback(t);
    }).catch((err) => {
      console.log(err.message)
    });
  }

  static fromJson(dict) {
    /* This is a hack that should probably be replaced by some kind of library. */
    console.log(`${dict.lights}`)
    var lights = dict.lights.map((x) => new Light(new LatLng(x.latlng.latitude, x.latlng.longitude), x.ip, x.lastStatus));
    console.log(lights);
    return new Track(dict.name, dict.region, lights);
  }

  static jsonCensor(key, value) {
    //console.log(`Received ${key}`);
    if (key[0] === '_') return undefined
    if (key == 'region') return {
      'latitude' : this.region.latitude,
      'latitudeDelta' : this.region.latitudeDelta,
      'longitude' : this.region.longitude,
      'longitudeDelta' : this.region.longitudeDelta
    }
    if (key === '_socket') return undefined
    //console.log(`Letting ${key} through!`);
    return value;
  }
}

const mason = {latitude: 38.92188114803696, longitude: -82.08681528039551};
const masonName = 'Mason County Fair';

export default class MyApp extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      track: undefined,
      tracks: undefined,
      addingTrack: false,
      trackName: undefined,
    };
    RNFS.readDir(Track.getTrackFolder())
    .then((result) => {
      this.setState({tracks: result.filter((x) => x.size > 0)});
    }
    ).catch((err) => console.log(err.message));

  }

  selectTrack(trackFile) {
    console.log(trackFile.name);
    Track.fromTrackName(trackFile.name, (returned) => {
      console.log(`Loaded track ${returned}`);
      this.setState({
        track: returned
      });
    });
  }

  handleTrackName(text) {
    this.setState({trackName: text});
  }
  handleLat(text) {
    this.setState({lat: text});
  }

  handleLong(text) {
    this.setState({long: text});
  }


  addTrackScreen() {
    goBack = () => this.setState({addingTrack: false});
    createTrack = () => {
      /* TODO: Support typing in lat and long for cheap tablets without geolocation */
      navigator.geolocation.getCurrentPosition(
        (locInfo) => {
          console.log(`Detected location to be ${locInfo.coords.latitude}`);
          var t = new Track(
            this.state.trackName,
            { 
              latitude: locInfo.coords.latitude,
              longitude: locInfo.coords.longitude,
              latitudeDelta: 0.0025,
              longitudeDelta: 0.0025,
            },
            []
          );
          t.saveTrack(true)
            .then(() => {
              this.setState({track: t, addingTrack: false})
              console.log(`Saved ${t.name}!`);
            })
            .catch((err) => console.log(`Error creating track ${err.message}`));
        },
        (err) => console.log(err.message),
        { timeout: 10000, maximumAge: 0, enableHighAccuracy: true }
      );
      //var t = new Track(this.state.trackName, loc, []); 
    }

    return (
      <Container>
        <Header>
          <Left>
            <Button onPress={goBack}>
              <BaseIcon name="md-arrow-back"/>
            </Button>
          </Left>
          <Body><Title>Create New Track</Title></Body>
        </Header>
        <Content>
          <Form>
            <Item>
              <Input placeholder="Track Name" onChangeText={(e) => this.handleTrackName(e)} value={this.state.trackName}/>
            </Item>
          </Form>
        </Content>
        <Footer>
          <FooterTab>
            <Button onPress={goBack}>
              <Text>Cancel</Text>
            </Button>
            <Button active onPress={createTrack}>
              <Text>OK</Text>
            </Button>
          </FooterTab>
        </Footer>
      </Container>
    );
  }

  handlePermissions() {
    try {
      PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          'title': 'MotoLights Location Permission',
          'message': 'We need your location to locate ' +
                     'you on-track.'
        }
      ).then((granted) => console.log(granted));
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        console.log("You can use the camera")
      } else {
        console.log("Camera permission denied")
      }
    } catch (err) {
      console.warn(err)
    }
  }

  removeTrack(index) {
    console.log(index);
    var t = this.state.tracks[index];
    RNFS.unlink(t.path)
      .then(() => console.log(`Deleted ${t.name}!`))
      .catch((err) => console.log(`Failed to delete ${t.name}! ${err.message}`));
    var newTracks = this.state.tracks.slice();
    newTracks.splice(index, 1);
    this.setState({tracks: newTracks});
  }

  render() {
    if (this.state.addingTrack) {
      return this.addTrackScreen();
    }
    const availableTracks = this.state.tracks;
    console.log(this.selectTrack);
    // This will facilitate the last TODO, reading track over network from multicast.
    if (!this.state.track) {
      if (this.state.tracks == null) {
        // TODO better loading screen
        return <View style={[styles.container]}><ActivityIndicator size="large"/></View>
      }
      return (
        <Container>
          <Header>
            <Body>
              <Title>Select a Track</Title>
            </Body>
          </Header>
          <Content scrollEnabled={true}>
            <List>
              { availableTracks.length == 0 &&
                <ListItem><Text>
                  Make sure you're on the right WiFi,
                  then tap the refresh button!
                </Text></ListItem>
              }
            
              { /* TODO thumbnail of each track */
                availableTracks.map((track, index) =>
                  <ListItem key={track.name} onPress={() => this.selectTrack(track)}>
                    <Body >
                      <Text>{track.name}</Text>
                    </Body>
                    {/* This button is a little hard to press, but this will
                    keep users from accidentally deleting tracks. Move onPress to
                    right tag if they complain.*/}
                    <Right><BaseIcon name="md-close" onPress={() => this.removeTrack(index)}/></Right>
                  </ListItem>
                )
              }
            </List>
          </Content>
          {/* Could maybe wrap fab in view to be able to debug on device? */}
          <Fab
                active={true}
                direction="up"
                position="bottomRight"
                style={{}}
                containerStyle={{}}
                //onPress={() => console.log('TODO download track')}
                onPress={() => this.setState({addingTrack: true})} // TODO supposed to be longpress
              >
              <BaseIcon name='md-refresh'/>
              </Fab>
        </Container>
      );
    };

    // Fall through to track if we've already chosen
    return <TrackComponent
      track={this.state.track}
      clearSelection={() => this.state.trackName = undefined}
      style={{width: "100%", height: "100%"}}
    />
  }
}

class TrackComponent extends React.Component {
  constructor(props) {
    super(props);

    //setTimeout(() => this.forceUpdate(), 300);
    
    //var t = new Track();
    this.state = {
      counter: 392,
      track: props.track,
      currentMode: 2,
      isMapReady: false,
      lightEditing: false,
    };


    this.modes = [{ 
      title: 'Ride',
      icon: 'md-bicycle',
      buttonColor: 'green',
      onSelect: () => console.log("hi"),
      index: 0
    },
    { 
      title: 'Control',
      icon: 'md-flag',
      buttonColor: 'gold',
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
      markerClicked: (e, light) => {
        console.log(e.nativeEvent.coordinate);
        console.log(light);
        this.setState({lightEditing: light});
      },
      onPress: (event) => this.createNewLight(event.nativeEvent.coordinate) 
    }
    ];
  } 

  selectMode(newMode) {
    this.setState({currentMode: newMode.index});
    // We only persist upon switching modes for simplicity
    this.state.track.saveTrack();
    if (newMode.onSelect) {
      newMode.onSelect();
    }
  }

  createNewLight(coords) {
    var track = Object.assign(new Track(), this.state.track);
    track.lights.push(new Light(new LatLng(coords.latitude, coords.longitude), null, false));
    this.setState({ track: track})
    track.saveTrack();
    console.log(`Created light at ${coords}`);
  }

  moveTrackRegion(newRegion) {
    this.state.track.region = {...newRegion};
    this.state.track.saveTrack();
    this.setState({track: this.state.track});
  }

  editLight(light) {
    var update = (text) => {
      light.ip = text;
      this.setState({lightEditing: light})
    };
    var save = () => {
      this.setState({
        /*lights: this.state.lights,*/
        lightEditing: null
      });
      this.state.track.saveTrack();
    }
    var ip = this.state.lightEditing.ip;
    var goBack = () => this.setState({lightEditing: null});
    return (
      <Container>
        <Header>
          <Left>
            <Button onPress={goBack}>
              <BaseIcon name="md-arrow-back"/>
            </Button>
          </Left>
          <Body><Title>Edit Light</Title></Body>
        </Header>
        <Content>
          <Form>
            <Item fixedLabel last error={ip==null}>
              <Label>IP</Label>
              <Input bad placeholder={(ip == null) ? "Enter the MotoLight's IP or it won't work!" : ip} onChangeText={update} value={this.state.lightEditing.ip}/>
            </Item>
          </Form>
        </Content>
        <Footer>
          <FooterTab>
            <Button onPress={goBack}>
              <Text>Cancel</Text>
            </Button>
            <Button active onPress={save}>
              <Text>OK</Text>
            </Button>
          </FooterTab>
        </Footer>
      </Container>
    )
    return null;
  }

  render() {
    var mode = this.modes[this.state.currentMode];
    if (this.state.track == null) { // Not done loading!
      return (
      <View style={{flex: 1}}>
        <Spinner textContent={"Loading..."} />
      </View>
      )
    }

    if (this.state.lightEditing) {
      return this.editLight(this.state.lightEditing);
    }
    return (
      <View style ={styles.map}>
        <StatusBar hidden />
        <MapView
          style={styles.map}
          region={this.state.track.region}
          mapType="satellite"
          showsPointsOfInterest={false}
          showBuildings={false}
          onPress={ mode.onPress ? (event) => mode.onPress(event) : null}
          onRegionChangeComplete={(reg) => this.moveTrackRegion(reg)}
          //scrollEnabled={false} Could use fitToCoordinates to size it?
          moveOnMarkerPress={false}
          //onLayout={console.log('Done!')}
          onLayout={() => this.setState({isMapReady: true})}
        >
        {/*<Marker coordinate={mason}/>*/}
        { this.state.isMapReady &&  
          this.state.track.lights.map(light => (
          <Marker key={light.latlng.longitude + mode.index} coordinate={light.latlng} title="hi"
            onPress={mode.markerClicked ? (e) => mode.markerClicked(e, light) : null}
            draggable={mode.markerDraggingEnabled}
            onDragEnd={mode.markerDraggingEnabled ? (e) => mode.markerDragEnd(e, light) : null}
            flat={true}
            anchor={{x: 0.5, y: 0.5}}
            >
            <View><Image source={light.lastStatus ? require('./assets/light_on.png') : require('./assets/light_off.png')} style={{width: 35, height: 35}}/></View>
            {/*<Callout style= {{width: 300, height: 70, flex: 1, alignItems: 'center'}}
              tooltip={false}
            >
              <View  style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text>IP - </Text>
                <TextInput style={{ width: 250}} 
                  placeholder={light.ip} value={light.ip} onChangeText={(val) => light.ip = val}/>
                </View>
          </Callout>*/}
          </Marker>
        ))
        }
        </MapView>

        {/* Floating mode switcher*/}
        {
        <ActionButton
          buttonColor={mode.buttonColor}
          renderIcon={(active) => active ? <Icon name="md-close"/> : <BaseIcon name={mode.icon}/>}
          >
          {this.modes.map((mode) => (
            <ActionButton.Item  key={mode.title}
              buttonColor={mode.buttonColor} title={mode.title} onPress={() => this.selectMode(mode)}>
              <BaseIcon name={mode.icon} style={styles.actionButtonIcon} />
            </ActionButton.Item>
          ))}
          {/*<ActionButton.Item key="hi">
            <Icon name="md-apps" style={styles.actionButtonIcon} />
        </ActionButton.Item>*/}
        </ActionButton>
        }
      </View>
    );
  }
}

const styles = StyleSheet.create({
  /*container: {
    ...StyleSheet.absoluteFillObject,
    //height: 400,
    //width: 400,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },*/
  bar: {
    justifyContent: "space-between",
    flexDirection: 'row'
  },
  map: {
    ...StyleSheet.absoluteFillObject,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});