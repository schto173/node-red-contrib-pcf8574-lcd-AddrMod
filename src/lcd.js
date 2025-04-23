// The MIT License (MIT)

// Copyright (c) 2019 Edrean Ernst

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

module.exports = function(RED) {
    const LCD = require('./lcd_driver.js');
    const i2c = require('i2c-bus');

    function LCDI2C(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        let addr = config.address ? parseInt(config.address, 16) : 0x27; // Use configured address or default
        const numLines = 4;
        const numCols = 20;

        // If no address is specified, use defaults based on variant
        if (!config.address) {
            switch (config.variant) {
                case "PCF8574":
                    addr = 0x27;
                    break;
                case "PCF8574AT":
                    addr = 0x3F;
                    break;
            }
        }

        switch (config.size) {
            case "20x4":
                numLines = 4;
                numCols = 20;
                break;
        }

        let lcd = null;
        try {
            const i2cBus = i2c.openSync(1);
            lcd = new LCD(i2cBus, {
                address: addr
            });

            if (lcd.isAlive()) {
                node.status({fill:"green", shape:"dot", text:"OK"});
            } else {
                node.status({fill:"red", shape:"dot", text:`Unreachable at 0x${addr.toString(16)}`});
                RED.log.error(`LCD is unreachable at address 0x${addr.toString(16)}. Please check address configuration and connection.`);
            }
        } catch (error) {
            node.status({fill:"red", shape:"dot", text:"Init Error"});
            RED.log.error(`Failed to initialize LCD: ${error.message}`);
            return;
        }

        node.on('input', function(msg) {
            if (!lcd) {
                node.status({fill:"red", shape:"dot", text:"Not initialized"});
                return;
            }

            if (!lcd.isAlive()) {
                node.status({fill:"red", shape:"dot", text:`Unreachable at 0x${addr.toString(16)}`});
                RED.log.error(`LCD is unreachable at address 0x${addr.toString(16)}. Please check address configuration and connection.`);
                return;
            }
            
            node.status({fill:"green", shape:"dot", text:"OK"});
            
            //Input validation
            if (msg === undefined) {
                RED.log.error("No input msg defined!");
                node.status({fill:"red", shape:"dot", text:"No input msg defined!"});
                return;
            }

            try {
                // Action
                if (msg.action !== undefined) {
                    switch (msg.action) {
                        case "clearscreen":
                            lcd.clear();
                            break;
                        case "off":
                            lcd.off();
                            break;
                        case "on":
                            lcd.on();
                            break;
                    }
                }

                // Payload
                if ((msg.payload !== undefined) && (Array.isArray(msg.payload))) {
                    for (let row = 0; row < numLines; row++) {
                        if (msg.payload[row] !== undefined) {
                            // Clear line if requested
                            if (msg.payload[row].clear) {
                                lcd.setCursor(0, row);
                                const clearStr = "".padStart(numCols, " ");
                                lcd.print(clearStr);
                            }

                            if (msg.payload[row].text !== undefined && msg.payload[row].text !== "") {
                                let x = 0;
                                if (msg.payload[row].alignment) {
                                    switch (msg.payload[row].alignment) {
                                        case "center":
                                            x = Math.floor((numCols - msg.payload[row].text.length) / 2);
                                            break;
                                        case "right":
                                            x = (numCols - msg.payload[row].text.length);
                                            break;
                                    }
                                }
                                lcd.setCursor(x, row);
                                lcd.print(msg.payload[row].text);
                            }
                        }
                    }   
                }
            } catch (error) {
                node.status({fill:"red", shape:"dot", text:"Error"});
                RED.log.error(`LCD operation failed: ${error.message}`);
            }
        });

        node.on('close', function(done) {
            if (lcd) {
                try {
                    lcd.clear();
                    lcd.off();
                } catch (error) {
                    RED.log.error(`Error while closing LCD: ${error.message}`);
                }
            }
            done();
        });
    }
    
    RED.nodes.registerType("LCD-I2C", LCDI2C);
}