/*
 * Project: ESP-IDF VSCode Extension
 * File Created: Wednesday, 5th June 2019 2:03:34 pm
 * Copyright 2019 Espressif Systems (Shanghai) CO LTD
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as vscode from "vscode";
import * as idfConf from "../../idfConfiguration";
import { Logger } from "../../logger/logger";
import { spawn } from "../../utils";
import { SerialPortDetails } from "./serialPortDetails";
import { OutputChannel } from "../../logger/outputChannel";

export class SerialPort {
  public static shared(): SerialPort {
    if (!SerialPort.instance) {
      SerialPort.instance = new SerialPort();
    }
    return SerialPort.instance;
  }

  private static instance: SerialPort;
  public promptUserToSelect(workspaceFolder: vscode.Uri) {
    return SerialPort.shared().displayList(workspaceFolder);
  }
  private async displayList(workspaceFolder: vscode.Uri) {
    const msg = vscode.l10n.t(
      "Select the available serial port where your device is connected."
    );

    try {
      let portList: SerialPortDetails[] = await this.list(workspaceFolder);
      const chosen = await vscode.window.showQuickPick(
        portList.map((l: SerialPortDetails) => {
          return {
            description: l.manufacturer,
            label: l.comName,
          };
        }),
        { placeHolder: msg }
      );
      if (chosen && chosen.label) {
        await this.updatePortListStatus(chosen.label, workspaceFolder);
      }
    } catch (error) {
      const msg = error.message
        ? error.message
        : "Something went wrong while getting the serial port list";
      Logger.errorNotify(
        msg,
        error
      );
      OutputChannel.appendLine(msg, "Serial port");
      OutputChannel.appendLineAndShow(JSON.stringify(error));
    }
  }

  public async getListArray(workspaceFolder: vscode.Uri) {
    return await this.list(workspaceFolder);
  }

  private async updatePortListStatus(l: string, wsFolder: vscode.Uri) {
    const settingsSavedLocation = await idfConf.writeParameter(
      "idf.port",
      l,
      vscode.ConfigurationTarget.WorkspaceFolder,
      wsFolder
    );
    const portHasBeenSelectedMsg = vscode.l10n.t("Port has been updated to ");
    Logger.infoNotify(
      `${portHasBeenSelectedMsg}${l} in ${settingsSavedLocation}`
    );
  }

  private list(workspaceFolder: vscode.Uri): Thenable<SerialPortDetails[]> {
    return new Promise(async (resolve, reject) => {
      try {
        const pythonBinPath = idfConf.readParameter(
          "idf.pythonBinPath",
          workspaceFolder
        ) as string;
        const buff = await spawn(pythonBinPath, ["get_serial_list.py"]);
        const regexp = /\'(.*?)\'/g;
        const arrayPrint = buff.toString().match(regexp);
        const choices: SerialPortDetails[] = Array<SerialPortDetails>();

        if (arrayPrint) {
          arrayPrint.forEach((portStr) => {
            const portChoice = portStr.replace(/'/g, "").trim();
            choices.push(new SerialPortDetails(portChoice));
          });
          resolve(choices);
        } else {
          reject(new Error("No serial ports found"));
        }
      } catch (error) {
        reject(error);
      }
    });
  }
}
