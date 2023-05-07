import React from 'react';
import './IgnoreUserList.scss';

import initMatrix from '../../../client/initMatrix';
import * as roomActions from '../../../client/action/room';

import Text from '../../atoms/text/Text';
import Chip from '../../atoms/chip/Chip';
import Input from '../../atoms/input/Input';
import Button from '../../atoms/button/Button';
import { MenuHeader } from '../../atoms/context-menu/ContextMenu';
import SettingTile from '../setting-tile/SettingTile';

import { useAccountData } from '../../hooks/useAccountData';

function IgnoreUserList() {
  useAccountData('m.ignored_user_list');
  const ignoredUsers = initMatrix.matrixClient.getIgnoredUsers();

  const handleSubmit = (evt) => {
    evt.preventDefault();
    const { ignoreInput } = evt.target.elements;
    const value = ignoreInput.value.trim();
    const userIds = value.split(' ').filter((v) => v.match(/^@\S+:\S+$/));
    if (userIds.length === 0) return;
    ignoreInput.value = '';
    roomActions.ignore(userIds);
  };

  return (
    <div className="ignore-user-list">
      <MenuHeader>Ignored users</MenuHeader>
      <SettingTile
        title="Ignore user"
        content={(
          <div className="ignore-user-list__users">
            <Text variant="b3">Ignore userId if you do not want to receive their messages or invites.</Text>
            <form onSubmit={handleSubmit}>
              <Input name="ignoreInput" required />
              <Button variant="primary" type="submit">Ignore</Button>
            </form>
            {ignoredUsers.length > 0 && (
              <div>
                {ignoredUsers.map((uId) => (
                  <Chip
                    faSrc="fa-solid fa-xmark"
                    key={uId}
                    text={uId}
                    // iconColor={CrossIC}
                    onClick={() => roomActions.unignore([uId])}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      />
    </div>
  );
}

export default IgnoreUserList;
