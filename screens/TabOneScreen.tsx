import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Buffer } from "buffer";
import { BleError, Device, State, Characteristic } from 'react-native-ble-plx';
import Slider from '@react-native-community/slider';

import { Text, View } from '../components/Themed';
import { RootTabScreenProps } from '../types';

import { manager } from '../components/BleManager';

export default function TabOneScreen({ navigation }: RootTabScreenProps<'TabOne'>) {
  const [connected, setConnected] = useState<Boolean>(false);
  const [ledBrightnessScroll, setLedBrightnessScroll] = useState<Number>(0);
  const [ledBrightnessNotif, setLedBrightnessNotif] = useState<Number>(0);
  const [ledUseNotif, setLedUseNotif] = useState<Boolean>(false);
  const [ledCharacteristic, setLedCharacteristic] = useState<Characteristic | null>(null);

  useEffect(() => {
    const subscription = manager.onStateChange((state: State) => {
      if (state === 'PoweredOn') {
        scanAndConnect();
        subscription.remove();
      }
    }, true);
    return () => subscription.remove();
  }, [manager]);

  useEffect(() => {
    if (ledCharacteristic == null)
      return;

    setLedUseNotif(false);
    const buf = Buffer.alloc(2);
    buf.writeUInt16LE(ledBrightnessScroll);
    ledCharacteristic.writeWithoutResponse(buf.toString('base64'));
  }, [ledBrightnessScroll]);

  useEffect(() => {
    if (ledCharacteristic == null)
      return;

    const subscription = ledCharacteristic.monitor((error, characteristic) => {
      if (error || characteristic == null) {
        return;
      }

      setLedBrightnessNotif(Buffer.from(characteristic?.value ?? 'AAA=', 'base64').readUInt16LE());
      setLedUseNotif(true);
    });
    return () => subscription.remove();
  }, [ledCharacteristic]);

  const scanAndConnect = () => {
    manager.startDeviceScan(null, null, async (error: BleError | null, device: Device | null) => {
      if (error != null || device == null) {
        // Handle error (scanning will be stopped automatically)
        return
      }

      if (device.serviceUUIDs != null) {
        const result = device.serviceUUIDs.find((uuid: String) => uuid === "0fdb887e-6150-11ec-90d6-0242ac120003");
        if (result == undefined) {
          return;
        }
        manager.stopDeviceScan();

        device.onDisconnected(() => {
          setConnected(false);
          scanAndConnect();
        });

        // Proceed with connection.
        device = await device.connect();
        device = await device.discoverAllServicesAndCharacteristics();
        const characteristic = await device.readCharacteristicForService("0fdb887e-6150-11ec-90d6-0242ac120003", "223fbac6-6150-11ec-90d6-0242ac120003");
        setLedBrightnessNotif(Buffer.from(characteristic?.value ?? 'AAA=', 'base64').readUInt16LE());
        setLedUseNotif(true);
        setLedCharacteristic(characteristic);
        setConnected(true);
      }
    });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Led Brightness</Text>
      <View style={styles.separator} lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />
      {connected ? <Text>Connected!</Text> : <Text>Connecting...</Text>}
      <Slider
        style={{ width: '75%', height: 40 }}
        minimumValue={0}
        maximumValue={65535}
        minimumTrackTintColor="#FFFFFF"
        maximumTrackTintColor="#000000"
        value={ledUseNotif ? ledBrightnessNotif : ledBrightnessScroll}
        onValueChange={setLedBrightnessScroll}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: '80%',
  },
});
