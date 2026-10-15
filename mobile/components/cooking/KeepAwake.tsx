import { useKeepAwake } from 'expo-keep-awake';

/** Mounted only while the recipe is on screen: the phone propped on the counter must not go to sleep. */
export default function KeepAwake(): null {
    useKeepAwake('cooking-assistant');
    return null;
}
