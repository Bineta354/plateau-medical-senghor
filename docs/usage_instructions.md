# Instructions for ToothCanvas Component

The `ToothCanvas` component now supports different tooth shapes based on a `type` prop.

## Usage

To use the `ToothCanvas` component, import it into any React component like this:

```javascript
import ToothCanvas from './components/dental-chart/ToothCanvas';

function MyDentalChartPage() {
  return (
    <div>
      <h1>Dental Chart</h1>

      <h2>Incisors</h2>
      <ToothCanvas toothId="11" type="incisor" width={80} height={80} />
      <ToothCanvas toothId="21" type="incisor" width={80} height={80} />

      <h2>Canines</h2>
      <ToothCanvas toothId="13" type="canine" width={80} height={80} />
      <ToothCanvas toothId="23" type="canine" width={80} height={80} />

      <h2>Premolars</h2>
      <ToothCanvas toothId="14" type="premolar" width={80} height={80} />
      <ToothCanvas toothId="24" type="premolar" width={80} height={80} />

      <h2>Molars</h2>
      <ToothCanvas toothId="16" type="molar" width={80} height={80} />
      <ToothCanvas toothId="26" type="molar" width={80} height={80} />

      {/* You can also use it without specifying a type, which will default to a generic shape */}
      <h2>Generic Tooth (default)</h2>
      <ToothCanvas toothId="38" width={80} height={80} />
    </div>
  );
}

export default MyDentalChartPage;
```

## Props

*   `toothId`: (String, required) The identifier for the tooth (e.g., "11", "Molar").
*   `type`: (String, optional) The type of tooth. Accepted values are:
    *   `"incisor"`
    *   `"canine"`
    *   `"premolar"`
    *   `"molar"`
    *   If not provided or an unknown type is given, a generic tooth shape will be drawn.
*   `width`: (Number, optional) The width of the canvas in pixels. Defaults to `100`.
*   `height`: (Number, optional) The height of the canvas in pixels. Defaults to `100`.

This completes the improvement of the `ToothCanvas` component based on your request.
