// A camera sees the same QR in many consecutive frames. Accept one result per
// camera start and stop the reader before the verification request begins.
export const singleScanCallback = (isCurrent, onScan) => {
  let accepted = false;
  return (result, _error, controls) => {
    if (!result || accepted || !isCurrent()) return;
    accepted = true;
    controls.stop();
    onScan(result.getText());
  };
};
